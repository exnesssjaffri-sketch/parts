# AutoMarts — Architecture

## Overview

AutoMarts is a full-stack auto parts e-commerce platform. It runs on two independently deployed servers behind a shared reverse proxy. The backend is an Express/TypeScript API backed by an embedded, in-memory WAL-mode SQLite database provided by sql.js. The frontend is a React 18 + Vite application using Tailwind CSS for styling.

## System Diagram

```
Browser ──► Vercel (Frontend static SPA)
                │
                │ /api/* proxy
                ▼
          Fly.io (Express 5 + TypeScript backend)
                │
                │ sql.js (WASM)
                ▼
          Embedded SQLite (.db on disk, WAL mode)
```

### Why two servers?

All application data lives in the SQLite database on the Fly.io worker. Deploying the database on the same host as the Express server avoids network latency and keeps the deployment simple. The Vercel-hosted frontend is a static asset distribution layer only; it proxies API calls to Fly.io.

## Frontend Architecture

- **Build tool:** Vite 5
- **Runtime:** React 18, React Router v7
- **State management:** React Context (AuthContext, CartContext)
- **Styling:** Tailwind CSS + custom component classes
- **HTTP client:** native `fetch()` wrapped in a typed `api` module

### Key components

| Component | Purpose |
|---|---|
| `Header` | Global navigation + search bar |
| `VehicleFinder` | Make → Model → Variant cascade selector |
| `ProductCard` | Product listing card |
| `Cart` | Cart drawer + checkout summary |
| `ProtectedRoute` | Route guard wrapping authenticated paths |
| `MFALogin` | MFA code entry page |

### Routing (React Router v7)

| Path | Auth required | Description |
|---|---|---|
| `/` | No | Home / featured products |
| `/products/:slug` | No | Product detail |
| `/cart` | No | Cart page |
| `/checkout` | Yes | Checkout flow |
| `/orders` | Yes | Order history |
| `/orders/:orderNumber` | Yes | Order detail + tracking |
| `/account` | Yes | Profile + addresses |
| `/mfa/setup` | Yes | MFA enrollment |
| `/admin/*` | Admin only | Admin dashboard & CRUD |

## Backend Architecture

- **Framework:** Express 5 + TypeScript
- **Database driver:** sql.js (WebAssembly SQLite)
- **Session storage:** In-memory Map with periodic cleanup
- **Password hashing:** bcrypt-compatible (pbkdf2Sync, 100k iterations, SHA-256)
- **MFA:** TOTP (RFC 6238) via `otpauth` library
- **Rate limiting:** Per-IP express-rate-limit
- **Input validation:** Zod schemas on all mutation endpoints

### Module layout

```
backend/src/
├── config/       # Environment config loader
├── db/
│   ├── index.ts  # sql.js wrapper (transaction, prepare, qRun)
│   ├── init.ts   # Schema initialization
│   └── schema.ts # Migration SQL
├── auth/         # Session management, MFA, password hashing
├── middleware/   # Rate limiting, auth, security headers
├── routes/
│   ├── auth.ts        # Login, register, MFA, OAuth
│   ├── products.ts    # Product catalog, vehicle finder
│   ├── cart.ts        # Cart operations
│   ├── orders.ts      # Checkout, tracking, cancellation
│   └── admin.ts       # Admin dashboard, CRUD
└── utils/
    ├── helpers.ts  # sanitizeHtml, formatPkr, slugify
    └── audit.ts    # Audit logging middleware
```

## Transaction Strategy

All write operations that touch multiple tables use the `transaction()` helper, which:
1. Executes `BEGIN`
2. Runs the callback with the transaction-bound `db` instance
3. Commits on success or rolls back on any error

Inside a transaction, every SQL call must use `prepare(sql, db).run()` (not the global `qRun`/`qAll`) so the statement binds to the transactional connection.

## Session Security

- Sessions stored in-memory as a `Map<string, SessionData>`
- `mfaPending: true` flag prevents mid-flow session reuse
- httpOnly + secure (production) + sameSite=lax cookies
- Periodic cleanup every 60 s removes expired sessions
- `authRequired` middleware rejects sessions where `mfaPending === true`