-- Fix RLS policies: correct UUID-to-bigint mismatches and tighten overly permissive policies
-- All IDs in this schema are BIGSERIAL (bigint), auth.uid() returns UUID text
-- Need to compare properly: auth.uid()::text vs id::text doesn't work for bigint IDs
-- Correct approach: use auth.jwt() ->> 'sub' for user ID, but our users table uses bigserial IDs
-- The simplest fix is to drop RLS from tables where it conflicts with the custom auth system
-- and only apply RLS where it makes sense with the session-based auth

-- Users: Only admin can see all, regular users can see their own profile
-- Since we use session-based auth (not Supabase Auth), auth.uid() returns null
-- We need to rely on the session middleware to set app_user in the request context
-- For now, disable RLS on users since the custom auth handles access control at the app layer
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Addresses: Same as users - custom auth handles access
DROP POLICY IF EXISTS "Users can manage own addresses" ON addresses;
ALTER TABLE addresses DISABLE ROW LEVEL SECURITY;

-- Categories: Public read active, admin write
DROP POLICY IF EXISTS "Categories public read" ON categories;
DROP POLICY IF EXISTS "Categories admin write" ON categories;
CREATE POLICY "categories_public_read" ON categories FOR SELECT USING (is_active = TRUE);
CREATE POLICY "categories_admin_all" ON categories FOR ALL USING (false);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Brands: Public read active, admin write  
DROP POLICY IF EXISTS "Brands public read" ON brands;
DROP POLICY IF EXISTS "Brands admin write" ON brands;
CREATE POLICY "brands_public_read" ON brands FOR SELECT USING (is_active = TRUE);
CREATE POLICY "brands_admin_all" ON brands FOR ALL USING (false);
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Vehicle makes: Public read active, admin write
DROP POLICY IF EXISTS "Vehicle makes public read" ON vehicle_makes;
DROP POLICY IF EXISTS "Vehicle makes admin write" ON vehicle_makes;
CREATE POLICY "vehicle_makes_public_read" ON vehicle_makes FOR SELECT USING (is_active = TRUE);
CREATE POLICY "vehicle_makes_admin_all" ON vehicle_makes FOR ALL USING (false);
ALTER TABLE vehicle_makes ENABLE ROW LEVEL SECURITY;

-- Vehicle models: Public read active, admin write
DROP POLICY IF EXISTS "Vehicle models public read" ON vehicle_models;
DROP POLICY IF EXISTS "Vehicle models admin write" ON vehicle_models;
CREATE POLICY "vehicle_models_public_read" ON vehicle_models FOR SELECT USING (is_active = TRUE);
CREATE POLICY "vehicle_models_admin_all" ON vehicle_models FOR ALL USING (false);
ALTER TABLE vehicle_models ENABLE ROW LEVEL SECURITY;

-- Vehicle variants: Public read active, admin write
DROP POLICY IF EXISTS "Vehicle variants public read" ON vehicle_variants;
DROP POLICY IF EXISTS "Vehicle variants admin write" ON vehicle_variants;
CREATE POLICY "vehicle_variants_public_read" ON vehicle_variants FOR SELECT USING (is_active = TRUE);
CREATE POLICY "vehicle_variants_admin_all" ON vehicle_variants FOR ALL USING (false);
ALTER TABLE vehicle_variants ENABLE ROW LEVEL SECURITY;

-- Products: Public read active, admin write
DROP POLICY IF EXISTS "Products public read" ON products;
DROP POLICY IF EXISTS "Products admin write" ON products;
CREATE POLICY "products_public_read" ON products FOR SELECT USING (is_active = TRUE);
CREATE POLICY "products_admin_all" ON products FOR ALL USING (false);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Product images: Public read, admin write
DROP POLICY IF EXISTS "Product images public read" ON product_images;
DROP POLICY IF EXISTS "Product images admin write" ON product_images;
CREATE POLICY "product_images_public_read" ON product_images FOR SELECT USING (TRUE);
CREATE POLICY "product_images_admin_all" ON product_images FOR ALL USING (false);
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Product specifications: Public read, admin write
DROP POLICY IF EXISTS "Product specs public read" ON product_specifications;
DROP POLICY IF EXISTS "Product specs admin write" ON product_specifications;
CREATE POLICY "product_specs_public_read" ON product_specifications FOR SELECT USING (TRUE);
CREATE POLICY "product_specs_admin_all" ON product_specifications FOR ALL USING (false);
ALTER TABLE product_specifications ENABLE ROW LEVEL SECURITY;

-- Product vehicle compatibility: Public read, admin write
DROP POLICY IF EXISTS "Product compatibility public read" ON product_vehicle_compatibility;
DROP POLICY IF EXISTS "Product compatibility admin write" ON product_vehicle_compatibility;
CREATE POLICY "product_compat_public_read" ON product_vehicle_compatibility FOR SELECT USING (TRUE);
CREATE POLICY "product_compat_admin_all" ON product_vehicle_compatibility FOR ALL USING (false);
ALTER TABLE product_vehicle_compatibility ENABLE ROW LEVEL SECURITY;

-- Cart items: Session-based, no RLS needed (handled by app layer)
DROP POLICY IF EXISTS "Cart items public access" ON cart_items;
ALTER TABLE cart_items DISABLE ROW LEVEL SECURITY;

-- Orders: Users can read their own, admins can read all
-- Since auth.uid() is null with session-based auth, disable RLS and handle in app layer
DROP POLICY IF EXISTS "Orders user read own" ON orders;
DROP POLICY IF EXISTS "Orders admin all" ON orders;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- Order items: Part of orders, handled by app layer
DROP POLICY IF EXISTS "Order items public read" ON order_items;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- Order status history: Part of orders, handled by app layer
DROP POLICY IF EXISTS "Order history public read" ON order_status_history;
ALTER TABLE order_status_history DISABLE ROW LEVEL SECURITY;

-- Coupons: Admin only, but since auth.uid() is null, disable RLS
DROP POLICY IF EXISTS "Coupons admin only" ON coupons;
ALTER TABLE coupons DISABLE ROW LEVEL SECURITY;

-- Coupon usage: Admin only, but since auth.uid() is null, disable RLS
DROP POLICY IF EXISTS "Coupon usage admin only" ON coupon_usage;
ALTER TABLE coupon_usage DISABLE ROW LEVEL SECURITY;

-- Audit logs: Admin only, but since auth.uid() is null, disable RLS
DROP POLICY IF EXISTS "Audit logs admin only" ON audit_logs;
DROP POLICY IF EXISTS "Audit logs admin insert" ON audit_logs;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- Wishlist: Users can manage their own - disable since auth.uid() is null
DROP POLICY IF EXISTS "Wishlist user manage own" ON wishlist_items;
ALTER TABLE wishlist_items DISABLE ROW LEVEL SECURITY;

-- Product reviews: Public read approved, users can create/update own
DROP POLICY IF EXISTS "Reviews public read" ON product_reviews;
DROP POLICY IF EXISTS "Reviews user write own" ON product_reviews;
CREATE POLICY "reviews_public_read" ON product_reviews FOR SELECT USING (is_approved = TRUE);
CREATE POLICY "reviews_admin_all" ON product_reviews FOR ALL USING (false);
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
