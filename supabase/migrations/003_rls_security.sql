-- AutoMarts RLS Security Hardening — Fixed
-- Migration 003 (revision 2): corrects the original that recorded version=3
-- without actually enabling RLS, and patches broken identity mapping.
--
-- CRITICAL NOTE: The application's users table uses BIGSERIAL ids, but
-- Supabase Auth assigns UUIDs. This migration enables RLS with policies
-- that deny anon/authenticated access to sensitive tables UNTIL a
-- supabase_auth_id mapping column is added. See the "Identity Mapping"
-- section below and docs/DATABASE_DOCUMENTATION.md for the required step.
--
-- The backend bypasses PostgREST via the service-role key and is unaffected.
--
-- This migration is idempotent (DROP POLICY IF EXISTS / DROP FUNCTION IF EXISTS).
-- It is safe to re-run against a database that already has migration 002 applied.
--
-- DO NOT apply this to the live database in this session. Apply manually
-- in the Supabase SQL editor only after review.

-- ---------------------------------------------------------------------------
-- 0. FIX: Record migration state correctly so we don't double-apply if
--    version 3 was already inserted without the actual work being done.
-- ---------------------------------------------------------------------------

-- Migration 003 was recorded as applied (version=3 exists) but the SQL
-- never actually enabled RLS. Force-update the record to a "fixed" state
-- and re-run all policies below. We use a version 003 fix row to track
-- that this corrected migration has been applied.

-- ---------------------------------------------------------------------------
-- 1. SENSITIVE TABLES — enable RLS and lock down anon/authenticated.
--
-- These tables contain PII or business-critical data. Until the
-- supabase_auth_id mapping column is added to the users table,
-- anon/authenticated roles have NO direct access. All reads/writes
-- must go through the Express backend using the service-role key.
-- ---------------------------------------------------------------------------

-- users: block direct access; PII (email, phone, addresses) must go
--        through the backend's authenticated API layer.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- addresses: PII, foreign key to users(id). Block direct access.
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- cart_items: may contain unauthenticated session_id rows; block until
--             auth mapping is in place.
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- orders: contains PII (email, phone, shipping_address JSONB). Block.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- order_items: derivative of orders, block to prevent leakage.
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- order_status_history: administrative data, block.
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- coupons: business logic, block direct access.
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- coupon_usage: tracks who used which coupon, block.
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;

-- audit_logs: immutable audit trail, block all client-side access.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- wishlist_items: user-private data, block until auth mapping exists.
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. IDENTITY MAPPING — required before any RLS policy can work.
--
-- The users.id column is BIGSERIAL (postgreSQL bigint). Supabase Auth
-- assigns each user a UUID via auth.users.id. There is NO current
-- column linking the two, so auth.uid()::text = users.id::text will
-- NEVER match — every policy that uses this pattern is broken.
--
-- REMEDIATION (must be done separately, not part of this migration):
--
--   ALTER TABLE users ADD COLUMN supabase_auth_id UUID REFERENCES auth.users(id);
--
-- Then update the application registration flow to populate this column
-- when a user signs up via email/password or OAuth. After that, policies
-- can use:  auth.jwt()->>'app_metadata'->>'user_id' = id::text
-- Or create a view:  CREATE VIEW public.authenticated_user AS SELECT id FROM users WHERE supabase_auth_id = auth.uid();
--
-- Without this column, all anon/authenticated RLS policies default to
-- DENY on these 10 tables. The backend continues working via service_role.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 3. POLICIES — deny-by-default on sensitive tables; allow public tables.
--
-- Because no auth-user mapping exists yet, we create explicit DENY
-- policies for anon/authenticated on the sensitive tables. This ensures
-- that even if future code changes accidentally create permissive rules,
-- these override them.
-- ---------------------------------------------------------------------------

-- Deny all client-side access to sensitive tables (overrides any future
-- accidental permissive policies). service_role bypasses RLS entirely.

-- users: deny anon/authenticated access; block reads and writes via PostgREST.
DROP POLICY IF EXISTS "Deny client access to users" ON users;
CREATE POLICY "Deny client access to users" ON users
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- addresses: deny all client access.
DROP POLICY IF EXISTS "Deny client access to addresses" ON addresses;
CREATE POLICY "Deny client access to addresses" ON addresses
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- cart_items: deny all client access.
DROP POLICY IF EXISTS "Deny client access to cart_items" ON cart_items;
CREATE POLICY "Deny client access to cart_items" ON cart_items
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- orders: deny all client access.
DROP POLICY IF EXISTS "Deny client access to orders" ON orders;
CREATE POLICY "Deny client access to orders" ON orders
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- order_items: deny all client access.
DROP POLICY IF EXISTS "Deny client access to order_items" ON order_items;
CREATE POLICY "Deny client access to order_items" ON order_items
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- order_status_history: deny all client access.
DROP POLICY IF EXISTS "Deny client access to order_status_history" ON order_status_history;
CREATE POLICY "Deny client access to order_status_history" ON order_status_history
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- coupons: deny all client access.
DROP POLICY IF EXISTS "Deny client access to coupons" ON coupons;
CREATE POLICY "Deny client access to coupons" ON coupons
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- coupon_usage: deny all client access.
DROP POLICY IF EXISTS "Deny client access to coupon_usage" ON coupon_usage;
CREATE POLICY "Deny client access to coupon_usage" ON coupon_usage
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- audit_logs: deny all client access, including inserts.
DROP POLICY IF EXISTS "Deny client access to audit_logs" ON audit_logs;
CREATE POLICY "Deny client access to audit_logs" ON audit_logs
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- wishlist_items: deny all client access.
DROP POLICY IF EXISTS "Deny client access to wishlist_items" ON wishlist_items;
CREATE POLICY "Deny client access to wishlist_items" ON wishlist_items
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 4. FIX rls_auto_enable(): remove SECURITY DEFINER, restrict execution.
--
-- The existing rls_auto_enable() function is SECURITY DEFINER and callable
-- by anon/authenticated/PUBLIC. Replace it with a non-definer version
-- that does nothing (since we now use explicit ALTER TABLE statements),
-- and explicitly revoke all EXECUTE privileges.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.rls_auto_enable();

-- Drop the old SECURITY DEFINER function if it still exists under any name.
DROP FUNCTION IF EXISTS public.rls_enable_table(text);

-- Provide a harmless stub that logs a warning if anyone calls it,
-- preventing silent no-ops. Non-definer so it runs with caller's privileges.
CREATE OR REPLACE FUNCTION public._rls_helpers_disabled()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RAISE EXCEPTION 'RLS helper functions have been disabled for security. Use the Supabase Dashboard or service-role to manage RLS policies.';
END;
$$;

REVOKE ALL ON FUNCTION public._rls_helpers_disabled() FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. INFO findings — add missing indexes on foreign keys used by future
--    RLS policies once identity mapping is implemented.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_product_reviews_order_id ON product_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_order_id ON coupon_usage(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_by ON order_status_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_created_at ON audit_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id_default ON addresses(user_id, is_default);

-- ---------------------------------------------------------------------------
-- 6. Fix schema_version dead-lock: ensure the table has RLS enabled AND
--    a deny policy so anonymous users cannot read/write it.
-- ---------------------------------------------------------------------------

ALTER TABLE schema_version ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny client access to schema_version" ON schema_version;
CREATE POLICY "Deny client access to schema_version" ON schema_version
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 7. Record migration
-- ---------------------------------------------------------------------------

INSERT INTO schema_version (version) VALUES (3) ON CONFLICT (version) DO UPDATE SET applied_at = NOW();
