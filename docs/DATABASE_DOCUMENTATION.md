# AutoMarts — Database Documentation

## Engine

Embedded SQLite via sql.js (WASM), running in WAL mode with periodic `PRAGMA synchronous = FULL` persistence. Data is stored in a `.db` file on the Fly.io worker filesystem.

## Schema Version

Current schema version: **2**

Migration 001 (initial) created all tables. Migration 002 added RLS policies (uses broken `auth.uid()::text = id::text` identity mapping — BIGINT vs UUID mismatch). Migration 003 (pending manual application) enables RLS on 10 sensitive tables with deny-all policies for anon/authenticated roles, removes the SECURITY DEFINER helper, and adds missing indexes.

### Supabase Identity Mapping Gap
The application's `users` table uses BIGSERIAL IDs while Supabase Auth assigns UUIDs. No column links the two. Until a `supabase_auth_id UUID` column is added to `users` and populated during registration/OAuth flows, per-user RLS policies cannot work. Migration 003 uses explicit deny-all policies (`USING (false) WITH CHECK (false)`) as a safe default until proper identity mapping is implemented.

## Tables

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | AUTOINCREMENT |
| email | TEXT UNIQUE NOT NULL | Login identifier |
| password_hash | TEXT NOT NULL | pbkdf2 hash (salt:hash) |
| first_name | TEXT NOT NULL | |
| last_name | TEXT NOT NULL | |
| phone | TEXT | Optional |
| is_admin | INTEGER DEFAULT 0 | |
| is_active | INTEGER DEFAULT 1 | |
| email_verified | INTEGER DEFAULT 0 | |
| mfa_secret | TEXT | Base32 TOTP secret |
| mfa_verified | INTEGER DEFAULT 0 | |
| created_at / updated_at | TEXT | datetime('now') |

**Indexes:** `idx_users_email`, `idx_users_is_admin`, `idx_users_mfa`

### `products`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| sku | TEXT UNIQUE NOT NULL | |
| name | TEXT NOT NULL | |
| slug | TEXT UNIQUE NOT NULL | URL-friendly |
| description | TEXT | |
| short_description | TEXT | |
| price | INTEGER | paisa (PKR × 100) |
| sale_price | INTEGER | paisa |
| cost_price | INTEGER | paisa |
| stock_quantity | INTEGER | |
| low_stock_threshold | INTEGER DEFAULT 5 | |
| weight_grams | INTEGER | |
| dimensions | TEXT | JSON {length, width, height} |
| condition | TEXT | new / refurbished / used |
| warranty_months | INTEGER | |
| brand_id | INTEGER FK → brands | SET NULL on delete |
| category_id | INTEGER FK → categories | SET NULL on delete |
| is_active | INTEGER DEFAULT 1 | |
| is_featured | INTEGER DEFAULT 0 | |
| meta_title / meta_description | TEXT | SEO |
| images | TEXT | JSON array of URLs |
| specifications | TEXT | JSON key-value specs |
| created_at / updated_at | TEXT | |

**Indexes:** sku, slug, category_id, brand_id, price, stock_quantity, is_active, is_featured

### `categories`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | TEXT UNIQUE NOT NULL | |
| slug | TEXT UNIQUE NOT NULL | |
| description | TEXT | |
| image_url | TEXT | |
| parent_id | INTEGER FK → categories(self) | NULL = top-level |
| sort_order | INTEGER DEFAULT 0 | |
| is_active | INTEGER DEFAULT 1 | |

**Indexes:** parent_id, is_active

### `brands`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | TEXT UNIQUE NOT NULL | |
| slug | TEXT UNIQUE NOT NULL | |
| description | TEXT | |
| logo_url / website_url | TEXT | |
| is_active | INTEGER DEFAULT 1 | |

**Indexes:** is_active

### `vehicle_makes` / `vehicle_models` / `vehicle_variants`
Three-table hierarchy for the vehicle compatibility finder. Each has `is_active`, `name`, `slug`, and foreign-key relationships.

**Indexes:** make_id on models, model_id + year on variants, is_active on all three.

### `product_vehicle_compatibility`
Junction table linking products to vehicle variants (many-to-many).
**Indexes:** product_id, variant_id.

### `carts` / `cart_items`
Anonymous cart identified by `session_id`; promoted to user cart on login/checkout.
**Indexes:** session_id, user_id.

### `orders` / `order_items` / `order_status_history`
Order lifecycle: pending → confirmed → processing → shipped → delivered / cancelled.
**Indexes:** order_number, user_id, session_id, status, created_at, idempotency_key on orders; order_id on items and history.

### `coupons` / `coupon_usage`
Percentage or fixed-amount discounts with expiry, min-order, and usage limits.
**Indexes:** code (unique), is_active, coupon_id + user_id on usage.

### `addresses`
User shipping/billing addresses.
**Indexes:** user_id.

### `product_reviews`
Star ratings with approval workflow.
**Indexes:** product_id, user_id, is_approved.

### `wishlist_items`
User wishlists.
**Indexes:** user_id, product_id.

### `audit_logs`
Immutable audit trail for all significant actions.
**Indexes:** user_id, entity_type+entity_id, created_at.

### `schema_version`
Tracks applied migration version.

## Data Types

All monetary values are stored as **integer paisa** (PKR × 100) to avoid floating-point rounding. The frontend and backend provide `paisaToPkr()` and `pkrToPaisa()` helpers.

## Transaction Safety

All multi-step writes use `transaction()` from `db/index.ts`. Inside a transaction, queries must use `prepare(sql, db)` to bind to the transactional connection; using global helpers bypasses the transaction boundary.
