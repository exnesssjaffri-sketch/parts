# AutoMarts — Design Decisions

## 1. sqlite.js (WASM) over Supabase Direct Access

**Decision:** Backend uses an embedded SQLite instance via sql.js instead of connecting directly to the Supabase PostgreSQL database.

**Why:** The project requires a self-contained backend that can be deployed to edge runtimes (Fly.io worker) without maintaining a persistent PostgreSQL connection. SQLite with WAL mode provides ACID transactions, good write throughput, and zero configuration. The Supabase project exists as a planned migration target and for its auth/ML features, not as the primary data store.

**Trade-off:** SQLite lacks some PostgreSQL features (native JSON, advanced indexing). For an auto-parts catalog at this scale it is sufficient. Migration to PostgreSQL is supported via the migration system.

## 2. In-Memory Session Store

**Decision:** Sessions are stored in a JavaScript `Map` rather than a database-backed store.

**Why:** Simplicity and speed. Session lookups are O(1) and there is no extra database round-trip on every request. The map is cleaned periodically (every 60 s) to prevent memory leaks.

**Trade-off:** Sessions are lost on server restart. For a demo/prototype this is acceptable. A production deployment would use Redis or a database-backed session store.

## 3. PKR Paisa Pricing

**Decision:** All monetary values are stored as integer paisa (PKR × 100) rather than floating-point PKR.

**Why:** Floating-point arithmetic introduces rounding errors (e.g., 0.1 + 0.2 !== 0.3). Integer math is exact and avoids display glitches at checkout.

**Trade-off:** Every price operation needs `pkrToPaisa()` / `paisaToPkr()` conversion. Centralized helpers prevent inconsistency.

## 4. Zod Schema Validation

**Decision:** All mutation endpoints use Zod schemas for request body validation.

**Why:** Runtime type safety in TypeScript. Validation errors are caught before any business logic runs, preventing malformed data from reaching the database.

**Trade-off:** Schemas must be maintained alongside the database schema. This is a small overhead that pays for itself in bug prevention.

## 5. MFA Challenge Token via Request Body

**Decision:** The MFA challenge token is passed in the `/mfa/challenge` request body rather than stored server-side in request-local state.

**Why:** The original implementation stored the token in `req.__mfaChallengeToken` during `/login`, but `/mfa/challenge` is a separate HTTP request where that property does not exist. Passing the token in the body ensures the challenge flow works across the full request cycle. The token is validated against the session store and bound to the user ID.

**Trade-off:** The token is transmitted in the request body (still over HTTPS). It is single-use and immediately deleted after successful verification.

## 6. ProtectedRoute Wrapper

**Decision:** A single `ProtectedRoute` component wraps all authenticated routes in React Router.

**Why:** Centralized auth check prevents accidental exposure of protected pages. Admin-only routes add an additional `isAdmin` check.

**Trade-off:** Client-side protection can be bypassed by disabling JavaScript. Server-side route guards (already present via Express middleware) provide the real security boundary.

## 7. No Client-Side State Management Library

**Decision:** Used React Context instead of Redux, Zustand, or Jotai.

**Why:** The application has two main state domains (auth + cart) that do not require complex cross-component synchronization. Context is sufficient and avoids bundle size overhead.

**Trade-off:** Context re-renders all consumers on every state change. For this app size it is negligible.

## 8. Native fetch() Over Axios

**Decision:** Used the native `fetch()` API with a typed wrapper instead of Axios.

**Why:** No dependency overhead. Modern browsers and Node 18+ support fetch natively. The wrapper provides consistent error handling and TypeScript types.

**Trade-off:** No automatic JSON parsing, interceptors, or request cancellation out of the box — all handled manually in the wrapper.
