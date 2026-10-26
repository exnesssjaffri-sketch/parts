-- AutoMarts RLS Policies
-- Row Level Security for all tables

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_makes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_vehicle_compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- Users: Users can read their own data, admins can read all
DROP POLICY IF EXISTS "Users can read own data" ON users;
CREATE POLICY "Users can read own data" ON users FOR SELECT USING (auth.uid()::text = id::text OR is_admin = TRUE);

DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid()::text = id::text);

-- Addresses: Users can manage their own addresses
DROP POLICY IF EXISTS "Users can manage own addresses" ON addresses;
CREATE POLICY "Users can manage own addresses" ON addresses USING (auth.uid()::text = user_id::text) WITH CHECK (auth.uid()::text = user_id::text);

-- Categories: Public read, admin write
DROP POLICY IF EXISTS "Categories public read" ON categories;
CREATE POLICY "Categories public read" ON categories FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Categories admin write" ON categories;
CREATE POLICY "Categories admin write" ON categories FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::bigint AND is_admin = TRUE));

-- Brands: Public read, admin write
DROP POLICY IF EXISTS "Brands public read" ON brands;
CREATE POLICY "Brands public read" ON brands FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Brands admin write" ON brands;
CREATE POLICY "Brands admin write" ON brands FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::bigint AND is_admin = TRUE));

-- Vehicle makes/models/variants: Public read, admin write
DROP POLICY IF EXISTS "Vehicle makes public read" ON vehicle_makes;
CREATE POLICY "Vehicle makes public read" ON vehicle_makes FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Vehicle makes admin write" ON vehicle_makes;
CREATE POLICY "Vehicle makes admin write" ON vehicle_makes FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::bigint AND is_admin = TRUE));

DROP POLICY IF EXISTS "Vehicle models public read" ON vehicle_models;
CREATE POLICY "Vehicle models public read" ON vehicle_models FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Vehicle models admin write" ON vehicle_models;
CREATE POLICY "Vehicle models admin write" ON vehicle_models FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::bigint AND is_admin = TRUE));

DROP POLICY IF EXISTS "Vehicle variants public read" ON vehicle_variants;
CREATE POLICY "Vehicle variants public read" ON vehicle_variants FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Vehicle variants admin write" ON vehicle_variants;
CREATE POLICY "Vehicle variants admin write" ON vehicle_variants FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::bigint AND is_admin = TRUE));

-- Products: Public read active products, admin write
DROP POLICY IF EXISTS "Products public read" ON products;
CREATE POLICY "Products public read" ON products FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Products admin write" ON products;
CREATE POLICY "Products admin write" ON products FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::bigint AND is_admin = TRUE));

-- Product images: Public read, admin write
DROP POLICY IF EXISTS "Product images public read" ON product_images;
CREATE POLICY "Product images public read" ON product_images FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Product images admin write" ON product_images;
CREATE POLICY "Product images admin write" ON product_images FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::bigint AND is_admin = TRUE));

-- Product specifications: Public read, admin write
DROP POLICY IF EXISTS "Product specs public read" ON product_specifications;
CREATE POLICY "Product specs public read" ON product_specifications FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Product specs admin write" ON product_specifications;
CREATE POLICY "Product specs admin write" ON product_specifications FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::bigint AND is_admin = TRUE));

-- Product vehicle compatibility: Public read, admin write
DROP POLICY IF EXISTS "Product compatibility public read" ON product_vehicle_compatibility;
CREATE POLICY "Product compatibility public read" ON product_vehicle_compatibility FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Product compatibility admin write" ON product_vehicle_compatibility;
CREATE POLICY "Product compatibility admin write" ON product_vehicle_compatibility FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::bigint AND is_admin = TRUE));

-- Cart items: Allow all for session-based carts
DROP POLICY IF EXISTS "Cart items public access" ON cart_items;
CREATE POLICY "Cart items public access" ON cart_items FOR ALL USING (TRUE);

-- Orders: Users can read their own orders, admins can read all
DROP POLICY IF EXISTS "Orders user read own" ON orders;
CREATE POLICY "Orders user read own" ON orders FOR SELECT USING (auth.uid()::text = user_id::text OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::bigint AND is_admin = TRUE));

DROP POLICY IF EXISTS "Orders admin all" ON orders;
CREATE POLICY "Orders admin all" ON orders FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::bigint AND is_admin = TRUE));

-- Order items: Public read (tied to orders)
DROP POLICY IF EXISTS "Order items public read" ON order_items;
CREATE POLICY "Order items public read" ON order_items FOR SELECT USING (TRUE);

-- Order status history: Public read
DROP POLICY IF EXISTS "Order history public read" ON order_status_history;
CREATE POLICY "Order history public read" ON order_status_history FOR SELECT USING (TRUE);

-- Coupons: Admin only
DROP POLICY IF EXISTS "Coupons admin only" ON coupons;
CREATE POLICY "Coupons admin only" ON coupons FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::bigint AND is_admin = TRUE));

-- Coupon usage: Admin only
DROP POLICY IF EXISTS "Coupon usage admin only" ON coupon_usage;
CREATE POLICY "Coupon usage admin only" ON coupon_usage FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::bigint AND is_admin = TRUE));

-- Audit logs: Admin only, never expose to regular users
DROP POLICY IF EXISTS "Audit logs admin only" ON audit_logs;
CREATE POLICY "Audit logs admin only" ON audit_logs FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::bigint AND is_admin = TRUE));
DROP POLICY IF EXISTS "Audit logs admin insert" ON audit_logs;
CREATE POLICY "Audit logs admin insert" ON audit_logs FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::bigint AND is_admin = TRUE));

-- Wishlist: Users can manage their own
DROP POLICY IF EXISTS "Wishlist user manage own" ON wishlist_items;
CREATE POLICY "Wishlist user manage own" ON wishlist_items USING (auth.uid()::text = user_id::text) WITH CHECK (auth.uid()::text = user_id::text);

-- Product reviews: Public read approved reviews, users can create/update own
DROP POLICY IF EXISTS "Reviews public read" ON product_reviews;
CREATE POLICY "Reviews public read" ON product_reviews FOR SELECT USING (is_approved = TRUE);

DROP POLICY IF EXISTS "Reviews user write own" ON product_reviews;
CREATE POLICY "Reviews user write own" ON product_reviews FOR ALL USING (auth.uid()::text = user_id::text);
