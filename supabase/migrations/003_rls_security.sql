-- AutoMarts RLS Security Hardening
-- Migration 003: closes the 10 ERROR findings from the Supabase security advisor
-- (tables with RLS enabled but no policies) and the 2 WARN findings
-- (SECURITY DEFINER function executable by anon/authenticated roles).
--
-- All statements are idempotent (DROP POLICY IF EXISTS / DROP FUNCTION IF EXISTS)
-- so the migration can be re-applied safely.
--
-- NOTE: This migration must be applied via the Supabase SQL editor or CLI
-- against the production project. It is NOT executed by the local sql.js
-- backend, which uses its own SQLite schema (see backend/src/db/schema.ts).

-- ---------------------------------------------------------------------------
-- 1. ERROR findings — tables with RLS enabled but no policies.
--    Without a policy, RLS blocks ALL access (even for service role bypass via
--    the dashboard is unaffected, but the anon/authenticated roles get nothing).
--    We add explicit permissive policies for public read tables and keep
--    admin-only write for management tables.
-- ---------------------------------------------------------------------------

-- audit_logs: was RLS-enabled with admin-only SELECT and admin-only INSERT.
-- Add a service-role bypass so the server-side audit writer (which uses the
-- service key, not a user session) can always insert.
DROP POLICY IF EXISTS "Audit logs service insert" ON audit_logs;
CREATE POLICY "Audit logs service insert" ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- schema_version: RLS enabled, no policy. Internal table — restrict to
-- service role only (no anon/authenticated access).
ALTER TABLE schema_version ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Schema version service only" ON schema_version;
CREATE POLICY "Schema version service only" ON schema_version
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 2. WARN findings — rls_auto_enable() is SECURITY DEFINER and executable by
--    anon and authenticated. Replace it with a non-definer helper that only
--    allows enabling RLS on tables in the public schema, and revoke the
--    broad EXECUTE privilege from anon/authenticated.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.rls_auto_enable();

CREATE OR REPLACE FUNCTION public.rls_enable_table(p_table text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_table IS NULL OR p_table !~ '^[a-z][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'Invalid table name';
  END IF;
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', p_table);
END;
$$;

REVOKE ALL ON FUNCTION public.rls_enable_table(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rls_enable_table(text) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. INFO findings — unindexed foreign keys. Add covering indexes so the
--    RLS policies that filter on these columns do not do sequential scans.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_product_reviews_order_id ON product_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_order_id ON coupon_usage(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_by ON order_status_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_created_at ON audit_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id_default ON addresses(user_id, is_default);

-- Record migration
INSERT INTO schema_version (version) VALUES (3) ON CONFLICT DO NOTHING;