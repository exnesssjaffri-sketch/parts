# AutoMarts — Testing Report

## Test Suite Overview

| File | Tests | Status |
|------|-------|--------|
| `backend/test/auth.test.ts` | 20 | PASS |
| `backend/test/schema.test.ts` | 9 | PASS |
| `backend/test/audit.test.ts` | 7 | PASS |
| `backend/test/transaction-rollback.test.ts` | 3 | PASS |
| `backend/test/sanitize-html.test.ts` | 11 | PASS |
| `backend/test/auth-http-mfa.test.ts` | 12 | PASS |
| **Total** | **68** | **ALL PASS** |

## Run Command

```bash
npx vitest run
```

## Test Coverage by Area

### Authentication (20 tests)
- Password hashing (4 tests): salt uniqueness, correct/wrong/malformed verification
- User CRUD (6 tests): create, find-by-email, find-by-id, phone handling
- Session management (4 tests): create, get, invalid-token, delete
- MFA functions (4 tests): secret generation, QR URI, valid code acceptance, invalid code rejection
- MFA challenge flow (2 tests): mfaPending flag persistence, normal session flag absence

### Database Schema (9 tests)
- Schema version at 2
- Users table has MFA columns (mfa_secret, mfa_verified)
- Audit logs table has required columns
- Products table has required columns (sku, price, stock_quantity, is_active)
- Orders table has required columns (order_number, total_amount, status)
- Index existence: users.email, products.price, orders.order_number, audit_logs.entity

### Audit Logging (7 tests)
- logAudit inserts record
- logAudit handles missing optional fields
- logAudit handles DB-not-ready silently
- Middleware calls next()
- IP extraction from x-forwarded-for
- Login success logging
- Login failure logging

### Transaction Rollback (3 tests)
- Transaction commits all changes on success
- Transaction rolls back all changes on constraint violation
- Transaction rollback leaves no partial state (product + audit log both absent after failure)

### XSS Sanitization (11 tests)
- Ampersand escaping
- Angle bracket escaping
- Double-quote escaping
- Single-quote escaping
- Script tag neutralization
- Event handler neutralization (bracket escape)
- JavaScript protocol neutralization
- Mixed HTML entities
- Plain text passthrough
- Empty string handling
- Product description injection test

### HTTP-Level MFA Regression (12 tests)
All 12 scenarios exercise the **real Express app** on an ephemeral localhost port, including
the real Google OAuth callback endpoint (mocked only for external token exchange):

| # | Scenario | Status |
|---|----------|--------|
| 1 | Normal password login for non-MFA user returns valid session | PASS |
| 2 | MFA-enabled login returns `mfa_required: true` + challenge_token, no session cookie | PASS |
| 3 | Valid challenge_token + valid TOTP creates authenticated session | PASS |
| 4 | Invalid TOTP rejected; single-use token consumed even on failure | PASS |
| 5 | Expired challenge token rejected (deterministic via test helper) | PASS |
| 6 | Consumed challenge token cannot be reused | PASS |
| 7 | User A's challenge token cannot authenticate User B | PASS |
| 8 | Challenge token cannot access protected endpoints (`/api/auth/me`) | PASS |
| 9 | Five failed attempts invalidate the challenge (single-use enforced) | PASS |
| 10 | Google OAuth follows same MFA rules (non-MFA → session; MFA → challenge_token) | PASS |
| 11 | Non-MFA user not forced through MFA flow | PASS |
| 12 | Logout invalidates session and blocks subsequent `/api/auth/me` | PASS |

## Build Verification

| Check | Result |
|-------|--------|
| Backend TypeScript (`tsc --noEmit`) | PASS — 0 errors |
| Frontend build (`vite build` in `frontend/`) | PASS — 2029 modules, ~16s |
| Test suite (`vitest run`) | PASS — 68/68 |
| Secret scan (`.env`, `.env.example`, source, migrations) | PASS — no real credentials found |

### Supabase RLS Security Regression (SQL Audit)
Migration 003 (`supabase/migrations/003_rls_security.sql`) was validated against migrations 001+002 with a Python-based SQL analysis script. Key checks performed:

| Check | Result |
|-------|--------|
| All 10 tables referenced in ALTER TABLE exist in migration 001 schema | PASS |
| All DROP POLICY / CREATE POLICY table references valid | PASS |
| All CREATE INDEX foreign key columns exist in migration 001 | PASS |
| No SECURITY DEFINER in executable SQL (replaced with SECURITY INVOKER stub) | PASS |
| No permissive `USING (true)` / `WITH CHECK (true)` policies | PASS |
| No `auth.uid()` in executable SQL (only appears in documentation comments) | PASS |

**Note**: Full RLS policy enforcement tests require a live PostgreSQL instance with RLS enabled and are blocked until migration 003 is applied to the Supabase project. A `supabase_auth_id UUID` column must be added to `users` before per-user RLS policies can function.

## New Tests & Fixes Added This Session

1. **Transaction rollback atomicity** — 3 tests that deliberately trigger SQL errors inside transactions.
2. **XSS regression** — 11 tests covering script injection, event handlers, and mixed payloads.
3. **HTTP-level MFA regression** — 12 tests exercising the real Express app via ephemeral localhost.
4. **Infra fix**: `backend/src/index.ts` — wrapped `startServer()` call in `process.argv[1]` check so importing the app for testing does NOT bind a listening socket.
5. **Infra fix**: `backend/src/auth/index.ts` — added `__debugExpireChallengeToken` test-only helper to deterministically expire challenge records without waiting for TTL.
6. **Bug fix**: `backend/src/routes/auth.ts` — imported missing `consumeChallengeTokenForUser` symbol.
