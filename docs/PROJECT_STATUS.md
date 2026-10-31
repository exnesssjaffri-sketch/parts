# AutoMarts — Project Status

## Latest Audit — 2026-10-31

### Issues Found & Fixed (this session)
| Severity | Count | Status |
|----------|-------|--------|
| P0 — MFA challenge token lost between requests | 1 | FIXED |
| P1 — Transaction atomicity broken | 1 | FIXED |
| P1 — Protected routes exposed | 1 | FIXED |
| P1 — HTML sanitization broken (syntax) | 1 | FIXED |
| P2 — Vehicle finder API mismatch | 1 | FIXED |
| P2 — Duplicate SearchBar | 1 | FIXED |
| P2 — Login TDZ violation | 1 | FIXED |
| P3 — Admin page type errors | ~5 | NOT MODIFIED (pre-existing) |

### Security & Compliance
| Control | Status |
|---------|--------|
| Password hashing (pbkdf2, 100k iter) | PASS |
| MFA (TOTP, RFC 6238) | PASS |
| Session security (httpOnly, secure, sameSite=lax) | PASS |
| Rate limiting (auth endpoints) | PASS |
| Input validation (Zod schemas) | PASS |
| SQL injection prevention (parameterized) | PASS |
| XSS prevention (Zod + sanitizeHtml) | PASS |
| CSRF protection (sameSite=lax + same-origin) | PASS |
| Transport security (HTTPS enforced in production) | PASS |
| Audit logging (all auth events) | PASS |
| Secret scan (env, source, migrations) | PASS |

### Build Status
- Backend TypeScript (`tsc --noEmit`): PASS — 0 errors
- Frontend (`vite build` from `frontend/`): PASS — 2029 modules
- Tests (`vitest run`): **PASS — 68/68** (12 new HTTP-level MFA regression tests + SQL migration validation)

### Test Suite Composition
- `backend/test/auth.test.ts` — 20 (unit, in-process)
- `backend/test/auth-http-mfa.test.ts` — **12** (HTTP-level, real Express on ephemeral port)
- `backend/test/schema.test.ts` — 9
- `backend/test/audit.test.ts` — 7
- `backend/test/transaction-rollback.test.ts` — 3
- `backend/test/sanitize-html.test.ts` — 11

### Supabase RLS Status
- Migration 003 (`supabase/migrations/003_rls_security.sql`) **written but NOT applied** (read-only audit scope).
- **Corrected migration** (v2): enables RLS on all 10 sensitive tables with explicit `USING (false) WITH CHECK (false)` deny-all policies for anon/authenticated roles. Removes broken `auth.uid()::text = id::text` pattern (BIGINT vs UUID mismatch). Replaces SECURITY DEFINER helper with SECURITY INVOKER stub.
- Live DB state (confirmed via Supabase advisors): 10 public tables have RLS **disabled**; `rls_auto_enable()` still exists as SECURITY DEFINER callable by anon/authenticated.
- **Identity mapping gap**: No `supabase_auth_id UUID` column on `users` table — per-user RLS cannot work until this is added and populated during registration/OAuth flows. Until then, all sensitive tables use deny-all policies; backend continues working via service-role.
- **Blocker**: migration must be run manually in the Supabase SQL editor before any direct PostgREST exposure.

### MFA Challenge Store — Deployment Compatibility
- Current implementation: in-memory `Map<string, ChallengeRecord>` (see `backend/src/auth/index.ts`).
- Architecture assumption: single-process, non-serverless deployment. Under this assumption, the store is correct — single-use, per-user binding, TTL (120 s), 5-attempt cap.
- **Known limitation**: if the backend is deployed as a serverless function (e.g. Vercel) or scaled to multiple processes, each instance maintains its own map and challenge tokens will fail to validate across instances. This is a **deployment blocker for multi-instance/serverless**.
- Mitigation options (future): persist the challenge store to the Postgres DB via a `mfa_challenges` table, or bind the challenge to the client (encrypted, short-lived JWT) rather than server-side store.

### Documentation
- Final Submission Report: `docs/submission/AUTO_PARTS_PROJECT_FINAL_REPORT.md` + PDF
- Architecture: `docs/ARCHITECTURE.md`
- API: `docs/API_DOCUMENTATION.md`
- Database: `docs/DATABASE_DOCUMENTATION.md`
- Security Audit: `docs/SECURITY_AUDIT.md`
- Testing Report: `docs/TESTING_REPORT.md`
- Design Decisions: `docs/PROJECT_DESIGN_DECISIONS.md`
- Project Overview: `docs/PROJECT_OVERVIEW.md`
- Changelog: `CHANGELOG.md`
- This status file: `docs/PROJECT_STATUS.md`

### Pending Actions (Manual)
1. **Apply migration 003** in Supabase SQL editor (10-table RLS enablement + policies). See `supabase/migrations/003_rls_security.sql`.
2. Set production secrets (`JWT_SECRET`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`).
3. Configure CORS for production domain (restrict `ALLOWED_ORIGINS`).
4. Add `supabase_auth_id UUID REFERENCES auth.users(id)` to the `users` table before enabling per-user RLS policies (documented in migration 003 comments and SECURITY_AUDIT.md).
5. Revoke EXECUTE on `rls_auto_enable()` (migration 003 handles this).
5. Decide on MFA challenge store persistence if multi-instance/serverless deployment is planned.
