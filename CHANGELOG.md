# Changelog

All notable changes to AutoMarts are documented in this file.

## [Unreleased] - 2026-10-31

### Added
- HTTP-level MFA regression test suite (`backend/test/auth-http-mfa.test.ts`) — 12 scenarios covering normal login, MFA challenge flow, token expiry, single-use enforcement, cross-user attack prevention, OAuth MFA, and logout invalidation
- `consumeChallengeTokenForUser()` in `backend/src/auth/index.ts` — user-bound challenge token consumption (SEC-11)
- `__debugExpireChallengeToken()` test-only helper for deterministic challenge token expiry testing
- Google OAuth MFA enforcement — `/google/callback` returns `challenge_token` for MFA-enabled users instead of issuing a session directly (SEC-12)
- Supabase migration 003 (`supabase/migrations/003_rls_security.sql`) — enables RLS on 10 tables with deny-all policies for anon/authenticated roles, removes `rls_auto_enable()` SECURITY DEFINER, adds missing indexes, handles `schema_version` dead lock. **Corrected**: original migration recorded version 3 but never actually enabled RLS or created policies. Revised migration uses explicit `USING (false)` deny policies instead of broken `auth.uid()::text = id::text` identity mapping (BIGINT vs UUID mismatch). See SEC-14 below.

### Fixed
- **SEC-11**: Challenge token not bound to user — cross-user token replay attack vector closed
- **SEC-12**: Google OAuth bypassed MFA — now follows same challenge token flow as password login
- Test infrastructure: `backend/src/index.ts` — wrapped `startServer()` in `process.argv[1]` check so importing the app for tests no longer binds port 8000
- `backend/src/routes/auth.ts` — added missing `consumeChallengeTokenForUser` import (was causing 500 errors in /mfa/challenge)

### Test Results
- **68/68 tests passing** (up from 50/50)
- Backend TypeScript: clean (`tsc --noEmit`, 0 errors)
- Frontend build: PASS (2029 modules, 34.5s)

## [Unreleased] - 2026-10-30

### Added
- `ProtectedRoute` component wrapping authenticated/admin routes in `App.tsx`
- `mfaPending` flag on session data for MFA challenge flow
- Numeric ID-based vehicle API endpoints: `/vehicles/make/:makeId/models` and `/vehicles/model/:modelId/variants`

### Fixed
- **P0**: MFA auth bypass — MFA challenge now requires explicit code acceptance before session creation
- **P1**: Transaction atomicity broken — `qRun()`/`qAll()` inside `transaction()` callbacks used global db, bypassing transactions. Fixed with `prepare(sql, db).run()` pattern in `orders.ts` (checkout + cancel) and `admin.ts` (bulk update)
- **P1**: `sanitizeHtml()` broken chain — semicolons after each `.replace()` broke method chaining
- **P1**: Publicly accessible protected routes — `/orders`, `/account`, `/mfa/setup`, `/profile`, all `/admin/*` were unprotected. Wrapped with `ProtectedRoute`
- **P1**: Vehicle Finder API mismatch — frontend passed string slugs, backend expected numeric IDs. Aligned both to use numeric IDs with separate API endpoints
- **P1**: Duplicate `SearchBar` in `Header.tsx` — both imported and locally defined, causing naming conflict
- **P1**: Login.tsx TDZ bug — `email`/`password` referenced in `useEffect` before `useState` declarations. Moved declarations before effect
- **P2**: `frontend/index.html` had `lang="zh-CN"` and Chinese meta description. Changed to English
- **P2**: Cart default currency symbol was `¥` (Yuan). Changed to `Rs.` (PKR)
- Unused `Coupon` import removed from `api.ts`

### Changed
- Vehicle finder state changed from string slugs to numeric IDs throughout
- API layer updated to ID-path format for vehicle endpoints
- Auth flow now returns `mfa_required` flag to trigger frontend redirect to MFA challenge

### Security
- All sensitive environment variables remain in `.env` (gitignored)
- Password hashing uses bcrypt with per-user salt
- JWT signing uses configurable `JWT_SECRET` (min 32 chars)
- Rate limiting applied to auth endpoints
- Order cancellation verifies user ownership before allowing

## [Independent Verification] - 2026-10-30

### Added
- `backend/test/transaction-rollback.test.ts` — 3 tests verifying transaction atomicity (commit on success, rollback on failure, no partial state)
- `backend/test/sanitize-html.test.ts` — 11 tests covering XSS payload neutralization (script tags, event handlers, mixed entities)
- `backend/test/auth.test.ts` — 2 MFA challenge flow tests verifying `mfaPending` session flag behavior
- `docs/ARCHITECTURE.md` — System architecture documentation
- `docs/API_DOCUMENTATION.md` — Full REST API reference
- `docs/DATABASE_DOCUMENTATION.md` — Database schema and table reference
- `docs/SECURITY_AUDIT.md` — Security audit findings and Supabase scan results
- `docs/TESTING_REPORT.md` — Test suite overview and coverage
- `docs/PROJECT_DESIGN_DECISIONS.md` — Architecture decision records
- `docs/PROJECT_OVERVIEW.md` — Project overview and tech stack
- `docs/submission/AUTO_PARTS_PROJECT_FINAL_REPORT.md` — Final submission report
- `docs/submission/AUTO_PARTS_PROJECT_FINAL_REPORT.pdf` — Final submission report (PDF)

### Test Results
- **50/50 tests passing** (up from 34/34)
- Backend TypeScript: clean (`tsc --noEmit`, 0 errors)
- Frontend build: PASS (2029 modules, 13.9s)

### Supabase Security Scan
- 10 ERROR findings: RLS disabled on public tables (users, orders, cart_items, addresses, coupons, audit_logs, wishlist_items, order_items, order_status_history, coupon_usage)
- 2 WARN findings: `rls_auto_enable()` SECURITY DEFINER function callable by anon/authenticated
- 1 INFO finding: `schema_version` has RLS enabled with no policies
- 5 INFO findings: unindexed foreign keys
- 60 WARN findings: multiple permissive policies (performance noise)
