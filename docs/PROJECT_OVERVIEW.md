# AutoMarts — Project Overview

## What Is AutoMarts?

AutoMarts is a full-stack e-commerce application for auto spare parts. It provides:

- **Customer-facing storefront:** Product browsing, vehicle compatibility finder, shopping cart, checkout, order tracking
- **Admin dashboard:** Product/inventory management, order processing, customer oversight, sales reports
- **Security:** Email/password authentication, TOTP-based MFA, Google OAuth, role-based access control

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite 5, TypeScript, Tailwind CSS, React Router v7 |
| Backend | Express 5, TypeScript, sql.js (WASM SQLite) |
| Auth | Supabase Auth (Google OAuth), custom session management |
| Database | SQLite (embedded, WAL mode) |
| Deployment | Frontend → Vercel, Backend → Fly.io |

## Repository Structure

```
parts/
├── frontend/                  # React + Vite SPA
│   ├── src/
│   │   ├── components/       # Header, VehicleFinder, ProductCard, Cart
│   │   ├── context/          # AuthContext, CartContext
│   │   ├── pages/            # Home, ProductDetail, Cart, Checkout, Orders, Account, Admin
│   │   ├── utils/            # api.ts, supabase.ts
│   │   └── App.tsx           # Route definitions + ProtectedRoute
│   └── dist/                 # Built output
├── backend/                   # Express API server
│   ├── src/
│   │   ├── routes/           # auth, products, cart, orders, admin
│   │   ├── middleware/       # rateLimit, authRequired, securityHeaders
│   │   ├── auth/             # Session, MFA, password hashing
│   │   ├── db/               # sql.js wrapper, migrations
│   │   └── utils/            # helpers, audit logging
│   ├── test/                 # Vitest test suite (50 tests)
│   └── test-db/              # Temporary test databases (gitignored)
├── docs/                      # Audit & design documentation
├── CHANGELOG.md
└── README.md
```

## Key Features

1. **Vehicle Compatibility Finder** — Cascade selector: Make → Model → Year/Variant → shows compatible parts
2. **MFA-Protected Authentication** — TOTP codes via authenticator apps, challenge-token flow
3. **Google OAuth** — Sign-in with Google via Supabase
4. **PKR Pricing** — All prices in Pakistani Rupees, stored as integer paisa
5. **Order Management** — Full lifecycle: place → confirm → process → ship → deliver/cancel
6. **Admin Dashboard** — Sales analytics, inventory alerts, product CRUD, order status updates
7. **Audit Logging** — All authentication and administrative actions logged to `audit_logs`
8. **Idempotent Checkouts** — Idempotency keys prevent duplicate orders on network retry

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Minimum 32 characters, used for session token signing |
| `SESSION_SECRET` | Yes | Minimum 32 characters, used for cookie signing |
| `SUPABASE_URL` | Yes | Supabase project URL (for OAuth) |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `PORT` | No | Backend port (default: 8000) |
| `NODE_ENV` | No | `development` or `production` |