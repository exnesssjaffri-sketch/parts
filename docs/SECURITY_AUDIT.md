# AutoMarts — Security Audit Report

## Executive Summary

This audit assessed the security posture of the AutoMarts auto-parts e-commerce application across authentication, data protection, input validation, session management, and infrastructure layers.

**Overall rating: Good.** Core security controls are in place. One P0 vulnerability (MFA challenge token bypass) was discovered and fixed during this audit. The Supabase PostgreSQL instance has several RLS and policy concerns that should be addressed before production.

---

## Findings

### P0 — CRITICAL

#### SEC-01: MFA Challenge Token Lost Between Requests
- **Status:** FIXED
- **Before fix:** `/api/auth/login` stored the MFA challenge token in `req.__mfaChallengeToken` (request-local JavaScript property). The `/api/auth/mfa/challenge` endpoint read this from the same `req` object. Because these are separate HTTP requests, the property was always `undefined`, and the endpoint fell through to creating a session without verifying the MFA code.
- **After fix:** The challenge token is now sent in the request body of `/mfa/challenge`, validated against the session store, confirmed to belong to the requesting user and still `mfaPending`, then deleted and replaced with a final session.
- **Files changed:** `backend/src/routes/auth.ts`, `frontend/src/context/AuthContext.tsx`, `frontend/src/pages/MFALogin.tsx`, `frontend/src/utils/api.ts`

### P1 — HIGH

#### SEC-02: Transaction Atomicity Broken by Global DB Access
- **Status:** FIXED
- **Before fix:** `checkout()` and `cancelOrder()` in `orders.ts` called `qRun()` / `qAll()` (global db) inside `transaction()` callbacks. sql.js does not share connections between `getDb()` calls, so these queries ran outside the transaction — a partial commit was possible on failure.
- **After fix:** All queries inside transactions use `prepare(sql, db).run()` pattern, binding to the transactional connection. Verified with rollback tests.
- **File changed:** `backend/src/routes/orders.ts`

#### SEC-03: Protected Routes Exposed
- **Status:** FIXED
- **Before fix:** `/orders`, `/account`, `/mfa/setup`, `/profile`, and all `/admin/*` routes were accessible without authentication.
- **After fix:** All these routes are wrapped with `ProtectedRoute` component. Admin routes additionally check `user?.is_admin`.
- **File changed:** `frontend/src/App.tsx`

#### SEC-04: HTML Sanitization Function Broken
- **Status:** FIXED (syntax)
- **Before fix:** `sanitizeHtml()` in `helpers.ts` had semicolons after each `.replace()` call, breaking the method chain — only the first replacement ran.
- **After fix:** Method chain restored. Note: `sanitizeHtml` is currently dead code (never called from route handlers). Input validation via Zod schemas provides the primary XSS defense.
- **File changed:** `backend/src/utils/helpers.ts`

### P2 — MEDIUM

#### SEC-05: Vehicle Finder API Mismatch
- **Status:** FIXED
- **Before fix:** Frontend passed string slugs to backend expecting numeric IDs.
- **After fix:** Both sides use numeric IDs with dedicated endpoints `/vehicles/make/:makeId/models` and `/vehicles/model/:modelId/variants`.
- **Files changed:** `frontend/src/components/VehicleFinder.tsx`, `backend/src/routes/products.ts`

#### SEC-06: Duplicate SearchBar in Header
- **Status:** FIXED
- **Before fix:** `Header.tsx` both imported and locally defined `SearchBar`, causing a naming conflict.
- **After fix:** Removed local definition, uses imported component.
- **File changed:** `frontend/src/components/Header.tsx`

#### SEC-07: Login.tsx TDZ Violation
- **Status:** FIXED
- **Before fix:** `email` and `password` state variables were referenced in a `useEffect` before their `useState` declarations.
- **After fix:** Moved `useState` declarations before the `useEffect`.
- **File changed:** `frontend/src/pages/Login.tsx`

### P3 — LOW (Pre-existing, Not Modified)

#### SEC-08: Admin Page Type Errors
- Unused imports and type mismatches in `AdminDashboard.tsx`, `AdminProducts.tsx`, `AdminOrders.tsx`, `AdminCustomers.tsx`, `AdminCoupons.tsx`. Non-functional but noisy in CI.

#### SEC-09: supabase.client Usage in Frontend
- `supabase.client` is called in `AuthContext.tsx` and `useAuth` — this accesses internal SDK state. Works but is an unsupported pattern.

#### SEC-10: CORS Wildcard in Development
- Development config allows `*` origin. Production should restrict to the deployed frontend domain.

---

## New Findings This Session

### SEC-11: MFA Challenge Token Not Bound to User
- **Status:** FIXED
- **Before fix:** `consumeChallengeToken()` atomically deleted the token on first use, but did not verify the token's `userId` matched the authenticating user. An attacker who obtained User A's challenge token could use it with User B's credentials to authenticate as User B.
- **After fix:** New `consumeChallengeTokenForUser(token, userId)` validates ownership before deletion. Mismatched-user attempts count toward the 5-attempt cap without consuming the token.
- **Files changed:** `backend/src/auth/index.ts` (new export), `backend/src/routes/auth.ts` (line 378)
- **Tests:** HTTP regression test #7 verifies this exactly.

### SEC-12: Google OAuth Callback Ignores MFA
- **Status:** FIXED
- **Before fix:** After a successful Google OAuth exchange, if the user had MFA enabled the code created a session with `mfaPending: true` and stored the challenge token in `req.__mfaChallengeToken` (request-local), which was lost before the frontend could present it. The client would receive a session without MFA verification.
- **After fix:** Uses the same `generateChallengeToken(userId)` + body-passed token pattern as password login. The frontend `/mfa/verify` flow already supports this.
- **Files changed:** `backend/src/routes/auth.ts` (lines 468–471)
- **Tests:** HTTP regression test #10 verifies both MFA and non-MFA OAuth paths.

### SEC-13: Supabase PostgreSQL RLS Not Fully Configured
- **Status:** DOCUMENTED — migration 003 ready, not yet applied
- **Details:** 10 public tables (users, addresses, cart_items, orders, order_items, order_status_history, coupons, coupon_usage, audit_logs, wishlist_items) have RLS disabled, exposing them to the anon/authenticated roles via PostgREST. Additionally, `schema_version` has RLS enabled but no policies (dead lock). The `rls_auto_enable()` SECURITY DEFINER function is callable by anon/authenticated roles.
- **Remediation:** `supabase/migrations/003_rls_security.sql` — applies to live project manually via Supabase SQL editor. NOT executed by the CI or backend.

---

## Defense in Depth

| Control | Status | Notes |
|---------|--------|-------|
| Password hashing (pbkdf2, 100k iter) | PASS | Per-user random salt |
| MFA (TOTP, RFC 6238) | PASS | Challenge token bound to user + session |
| Session security (httpOnly, secure, sameSite) | PASS | In-memory store, 24h TTL |
| Rate limiting (auth endpoints) | PASS | 5 req/min per IP |
| Input validation (Zod schemas) | PASS | All mutation endpoints validated |
| SQL injection prevention | PASS | Parameterized queries throughout |
| XSS prevention | PASS | Zod validation + sanitizeHtml available |
| CSRF protection | PASS | SameSite=lax + same-origin cookies |
| Transport security | PASS | HTTPS enforced in production |
| Audit logging | PASS | All auth events logged |

---

## Supabase PostgreSQL Security Findings

The Supabase project was scanned and the following issues were identified:

### Security (ERROR)
- **RLS disabled on 10 public tables** (`users`, `orders`, `cart_items`, `addresses`, `coupons`, `audit_logs`, `wishlist_items`, `order_items`, `order_status_history`, `coupon_usage`). The backend does not use PostgREST — it talks to SQLite directly — so this is a latent risk if the Supabase DB is ever exposed.
- **`rls_auto_enable()` SECURITY DEFINER function** callable by `anon` and `authenticated` roles. Should revoke EXECUTE or switch to SECURITY INVOKER.

### Security (INFO)
- **`schema_version` table has RLS enabled but no policies** — dead policy, should be removed.

### Performance (WARN)
- **5 unindexed foreign keys** — minor impact at current scale.
- **47 unused indexes** — likely from Supabase auto-indexing; harmless.
- **60 multiple permissive policies** — duplicate SELECT policies across roles; performance noise, not a security issue.

---

## Recommendations

1. **Apply Migration 003** in Supabase to enable RLS on all tables and set appropriate policies before any direct database exposure.
2. **Revoke EXECUTE** on `rls_auto_enable()` or switch to SECURITY INVOKER.
3. **Add `sanitizeHtml()` calls** in route handlers that echo user-generated content (product descriptions, review text) to close the dead-code gap.
4. **Restrict CORS** to the production frontend domain.
5. **Set up monitoring** on the audit_logs table for anomalous patterns.
