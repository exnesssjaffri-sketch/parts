# AutoMarts — API Documentation

Base URL: `https://<backend-host>/api`
All JSON responses return `{ success, message, data }` shape unless noted.

## Authentication

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/auth/register` | No | `{ email, password, first_name, last_name, phone? }` | `{ user }` |
| POST | `/auth/login` | No | `{ email, password }` | `{ user, mfa_required?, challenge_token? }` |
| POST | `/auth/mfa/challenge` | No | `{ email, password, code, challenge_token }` | `{ user }` |
| POST | `/auth/logout` | Yes | — | `{ success }` |
| GET | `/auth/me` | Yes | — | `{ user }` |
| PUT | `/auth/profile` | Yes | `{ first_name?, last_name?, phone? }` | `{ user }` |
| POST | `/auth/change-password` | Yes | `{ current_password, new_password }` | `{ success }` |
| POST | `/auth/google/callback` | No | `{ code }` | `{ user, mfa_required?, challenge_token? }` |

### MFA Setup (authenticated)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/auth/mfa/setup` | — | `{ already_enabled, secret?, qr_code_uri? }` |
| POST | `/auth/mfa/verify` | `{ code }` | `{ success }` |
| POST | `/auth/mfa/disable` | `{ code }` | `{ success }` |
| GET | `/auth/mfa/status` | — | `{ mfa_enabled, mfa_pending }` |

## Products

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/products` | No | `Product[]` |
| GET | `/products/featured` | No | `Product[]` |
| GET | `/products/new-arrivals` | No | `Product[]` |
| GET | `/products/:slug` | No | `ProductDetail` |
| GET | `/products/:slug/related` | No | `Product[]` |
| GET | `/products/categories` | No | `Category[]` |
| GET | `/products/brands` | No | `Brand[]` |
| GET | `/products/search/suggestions?q=` | No | `string[]` |

## Vehicle Finder

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/products/vehicles/makes` | No | `{ makes }` |
| GET | `/products/vehicles/make/:makeId/models` | No | `{ models }` |
| GET | `/products/vehicles/model/:modelId/variants` | No | `{ variants }` |
| GET | `/products/vehicles/compatible-products?variant_id=` | No | `Product[]` |

## Cart

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/cart` | No | `{ items, summary }` |
| POST | `/cart` | No | `{ success, summary }` |
| PUT | `/cart/:productId` | No | `{ success, summary }` |
| DELETE | `/cart/:productId` | No | `{ success, summary }` |
| DELETE | `/cart` | No | `{ success }` |
| GET | `/cart/count` | No | `{ count }` |
| POST | `/cart/merge` | No | `{ success }` |

## Orders

| Method | Path | Auth | Response |
|--------|------|------|----------|
| POST | `/orders/checkout` | Yes | `{ order }` |
| GET | `/orders` | Yes | `{ orders, pagination }` |
| GET | `/orders/:orderNumber` | Yes | `{ order }` |
| GET | `/orders/track/:orderNumber` | No | `{ order }` (public tracking) |
| POST | `/orders/:orderNumber/cancel` | Yes | `{ success }` |

## Admin (requires admin role)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/admin/dashboard` | — | `{ stats, recent_orders, top_products }` |
| GET | `/admin/products` | — | `Product[]` |
| POST | `/admin/products` | Product data | `{ product }` |
| PUT | `/admin/products/:id` | Product data | `{ product }` |
| DELETE | `/admin/products/:id` | — | `{ success }` |
| GET | `/admin/orders` | — | `Order[]` |
| PUT | `/admin/orders/:id/status` | `{ status, notes? }` | `{ order }` |
| GET | `/admin/customers` | — | `User[]` |
| GET | `/admin/categories` | — | `Category[]` |
| POST | `/admin/categories` | `{ name, slug?, description?, parent_id?, sort_order? }` | `{ category }` |
| GET | `/admin/brands` | — | `Brand[]` |
| POST | `/admin/brands` | `{ name, slug?, description?, website_url? }` | `{ brand }` |
| GET | `/admin/coupons` | — | `Coupon[]` |
| POST | `/admin/coupons` | Coupon data | `{ coupon }` |
| GET | `/admin/reports/sales?period=` | — | `SalesReport` |
| GET | `/admin/reports/inventory` | — | `InventoryReport` |

## Security Notes

- All mutation endpoints are rate-limited per IP (auth: 5/min, others: 30/min)
- Auth endpoints use `validateBody` Zod schema validation
- Passwords hashed with pbkdf2 (100k iterations, SHA-256, random salt)
- Sessions: httpOnly cookie, in-memory store, 24 h TTL
- MFA challenge tokens are single-use and bound to user ID
- `sanitizeHtml()` is available but currently unused in route handlers
