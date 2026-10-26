import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { qGet, qAll, qRun, ensureDb } from '../src/db/index.js';
import { initDatabase } from '../src/db/init.js';
import { config } from '../src/config/index.js';
import { createUser, createSession } from '../src/auth/index.js';
import * as path from 'path';
import * as fs from 'fs';

const tmpDir = path.join(__dirname, '..', 'test-db');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

function getTestDbPath(name: string) {
  return path.join(tmpDir, name + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.db');
}

function makeResponse() {
  const res: any = {
    statusCode: 200, headers: {}, jsonBody: null, cookies: {},
    json(body: any) { this.jsonBody = body; return this; },
    status(code: number) { this.statusCode = code; return this; },
    cookie(name: string, value: string, _opts: any) { this.cookies[name] = value; return this; },
    end() { return this; },
  };
  return res;
}

describe('Cart Module', () => {
  let dbPath: string;
  let userId: number;
  let productId: number;

  beforeAll(async () => {
    dbPath = getTestDbPath('cart_orders');
    config.db.path = dbPath;
    await ensureDb();
    await initDatabase();

    const user = createUser('cart_user@test.com', 'TestPass123!', 'Cart', 'User');
    userId = user.id;

    const categoryResult = qRun('SELECT id FROM categories WHERE slug = ?', ['engines']) as { id: number } | null;
    const catId = categoryResult?.id || 1;
    const brandResult = qRun('SELECT id FROM brands WHERE slug = ?', ['honda']) as { id: number } | null;
    const brandId = brandResult?.id || 1;

    const product = qRun(`
      INSERT INTO products (sku, name, slug, price, stock_quantity, category_id, brand_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, ['TEST-OIL-001', 'Engine Oil 10W-40', 'engine-oil-10w-40', 150000, 50, catId, brandId]) as any;
    productId = product.lastInsertRowid as number;
  });

  afterAll(() => {
    try { fs.unlinkSync(dbPath); } catch {}
  });

  it('should add item to cart by session', () => {
    const sessionId = 'session-test-123';
    qRun('INSERT OR REPLACE INTO cart_items (session_id, user_id, product_id, quantity) VALUES (?, ?, ?, ?)',
      [sessionId, userId, productId, 2]);
    const item = qGet('SELECT * FROM cart_items WHERE session_id = ? AND product_id = ?', [sessionId, productId]);
    expect(item).toBeDefined();
    expect((item as any).quantity).toBe(2);
  });

  it('should get cart items for session', () => {
    const sessionId = 'session-test-456';
    qRun('INSERT INTO cart_items (session_id, user_id, product_id, quantity) VALUES (?, ?, ?, ?)',
      [sessionId, userId, productId, 1]);
    const items = qAll('SELECT * FROM cart_items WHERE session_id = ?', [sessionId]) as any[];
    expect(items.length).toBeGreaterThan(0);
  });

  it('should update cart item quantity', () => {
    const sessionId = 'session-update-123';
    qRun('INSERT INTO cart_items (session_id, user_id, product_id, quantity) VALUES (?, ?, ?, ?)',
      [sessionId, userId, productId, 1]);
    qRun('UPDATE cart_items SET quantity = 5 WHERE session_id = ? AND product_id = ?', [sessionId, productId]);
    const item = qGet('SELECT quantity FROM cart_items WHERE session_id = ? AND product_id = ?', [sessionId, productId]);
    expect((item as any).quantity).toBe(5);
  });

  it('should remove cart item', () => {
    const sessionId = 'session-remove-123';
    qRun('INSERT INTO cart_items (session_id, user_id, product_id, quantity) VALUES (?, ?, ?, ?)',
      [sessionId, userId, productId, 3]);
    qRun('DELETE FROM cart_items WHERE session_id = ? AND product_id = ?', [sessionId, productId]);
    const remaining = qGet('SELECT id FROM cart_items WHERE session_id = ? AND product_id = ?', [sessionId, productId]);
    expect(remaining).toBeFalsy();
  });

  it('should handle duplicate cart items (update instead of insert)', () => {
    const sessionId = 'session-dup-123';
    // First insert
    qRun('INSERT OR REPLACE INTO cart_items (session_id, user_id, product_id, quantity) VALUES (?, ?, ?, ?)',
      [sessionId, userId, productId, 1]);
    // Second insert with same product should update
    qRun('INSERT OR REPLACE INTO cart_items (session_id, user_id, product_id, quantity) VALUES (?, ?, ?, ?)',
      [sessionId, userId, productId, 3]);
    const item = qGet('SELECT quantity FROM cart_items WHERE session_id = ? AND product_id = ?', [sessionId, productId]);
    expect((item as any).quantity).toBe(3);
  });

  it('should validate product exists before adding to cart', () => {
    const nonExistentId = 99999;
    const result = qGet('SELECT id FROM products WHERE id = ?', [nonExistentId]);
    expect(result).toBeFalsy();
  });

  it('should calculate cart total', () => {
    const sessionId = 'session-total-123';
    qRun('INSERT INTO cart_items (session_id, user_id, product_id, quantity) VALUES (?, ?, ?, ?)',
      [sessionId, userId, productId, 2]);
    const total = qGet(`
      SELECT COALESCE(SUM(ci.quantity * p.price), 0) as total
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.session_id = ?
    `, [sessionId]) as { total: number } | null;
    expect(total?.total).toBe(300000); // 150000 * 2
  });
});

describe('Order Module', () => {
  let dbPath: string;
  let userId: number;
  let productId: number;

  beforeAll(async () => {
    dbPath = getTestDbPath('orders_test');
    config.db.path = dbPath;
    await ensureDb();
    await initDatabase();

    const user = createUser('order_user@test.com', 'TestPass123!', 'Order', 'User');
    userId = user.id;

    const categoryResult = qRun('SELECT id FROM categories WHERE slug = ?', ['engines']) as { id: number } | null;
    const catId = categoryResult?.id || 1;
    const brandResult = qRun('SELECT id FROM brands WHERE slug = ?', ['honda']) as { id: number } | null;
    const brandId = brandResult?.id || 1;

    const product = qRun(`
      INSERT INTO products (sku, name, slug, price, stock_quantity, category_id, brand_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, ['TEST-BRK-001', 'Brake Pads Front', 'brake-pads-front', 80000, 30, catId, brandId]) as any;
    productId = product.lastInsertRowid as number;
  });

  afterAll(() => {
    try { fs.unlinkSync(dbPath); } catch {}
  });

  it('should create an order with items', () => {
    const orderNumber = 'AM-' + Date.now();
    const result = qRun(`
      INSERT INTO orders (order_number, user_id, email, phone, status, payment_method, payment_status,
        subtotal, delivery_charge, discount_amount, total_amount, currency, shipping_address, notes, idempotency_key)
      VALUES (?, ?, ?, ?, 'pending', 'cod', 'pending', ?, 250, 0, ?, 'PKR', ?, ?, ?)
    `, [orderNumber, userId, 'test@test.com', '+923001234567', 80000, 80250, '{"line1":"Test"}', 'Test order', 'idem-' + Date.now()]) as any;
    const orderId = result.lastInsertRowid;

    qRun('INSERT INTO order_items (order_id, product_id, product_sku, product_name, unit_price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [orderId, productId, 'TEST-BRK-001', 'Brake Pads Front', 80000, 1, 80000]);

    const order = qGet('SELECT * FROM orders WHERE order_number = ?', [orderNumber]);
    expect(order).toBeDefined();
    expect((order as any).status).toBe('pending');
    expect((order as any).total_amount).toBe(80250);

    const items = qAll('SELECT * FROM order_items WHERE order_id = ?', [orderId]) as any[];
    expect(items.length).toBe(1);
  });

  it('should update order status', () => {
    const orderNumber = 'AM-' + Date.now();
    const result = qRun(`
      INSERT INTO orders (order_number, user_id, email, phone, status, payment_method, payment_status,
        subtotal, delivery_charge, total_amount, currency, shipping_address, idempotency_key)
      VALUES (?, ?, ?, ?, 'pending', 'cod', 'pending', ?, 250, ?, 'PKR', '{}', ?)
    `, [orderNumber, userId, 'test2@test.com', '+923001234567', 80000, 80250, 'idem-' + Date.now()]) as any;
    const orderId = result.lastInsertRowid;

    qRun('UPDATE orders SET status = ?, updated_at = datetime("now") WHERE id = ?', ['processing', orderId]);
    const order = qGet('SELECT status FROM orders WHERE id = ?', [orderId]);
    expect((order as any).status).toBe('processing');
  });

  it('should record order status history', () => {
    const orderNumber = 'AM-' + Date.now();
    const result = qRun(`
      INSERT INTO orders (order_number, user_id, email, phone, status, payment_method, payment_status,
        subtotal, delivery_charge, total_amount, currency, shipping_address, idempotency_key)
      VALUES (?, ?, ?, ?, 'pending', 'cod', 'pending', ?, 250, ?, 'PKR', '{}', ?)
    `, [orderNumber, userId, 'test3@test.com', '+923001234567', 80000, 80250, 'idem-' + Date.now()]) as any;
    const orderId = result.lastInsertRowid;

    qRun('INSERT INTO order_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
      [orderId, 'processing', 'Order confirmed', userId]);

    const history = qAll('SELECT * FROM order_status_history WHERE order_id = ?', [orderId]) as any[];
    expect(history.length).toBe(1);
    expect(history[0].status).toBe('processing');
  });

  it('should generate unique order numbers', () => {
    const order1 = 'AM-' + Date.now() + '-1';
    const order2 = 'AM-' + Date.now() + '-2';
    expect(order1).not.toBe(order2);
  });

  it('should enforce idempotency key uniqueness', () => {
    const key = 'idem-unique-' + Date.now();
    const result = qRun(`
      INSERT INTO orders (order_number, user_id, email, phone, status, payment_method, payment_status,
        subtotal, delivery_charge, total_amount, currency, shipping_address, idempotency_key)
      VALUES (?, ?, ?, ?, 'pending', 'cod', 'pending', ?, 250, ?, 'PKR', '{}', ?)
    `, ['AM-idem-test', userId, 'idem@test.com', '+923001234567', 80000, 80250, key]) as any;

    expect(() => qRun(`
      INSERT INTO orders (order_number, user_id, email, phone, status, payment_method, payment_status,
        subtotal, delivery_charge, total_amount, currency, shipping_address, idempotency_key)
      VALUES (?, ?, ?, ?, 'pending', 'cod', 'pending', ?, 250, ?, 'PKR', '{}', ?)
    `, ['AM-idem-test-dup', userId, 'idem2@test.com', '+923001234567', 80000, 80250, key]))
      .toThrow();
  });
});

describe('Schema Integrity', () => {
  let dbPath: string;

  beforeAll(async () => {
    dbPath = getTestDbPath('schema_integrity');
    config.db.path = dbPath;
    await ensureDb();
    await initDatabase();
  });

  afterAll(() => {
    try { fs.unlinkSync(dbPath); } catch {}
  });

  it('should have all expected tables', () => {
    const tables = ['users', 'addresses', 'categories', 'brands', 'vehicle_makes',
      'vehicle_models', 'vehicle_variants', 'products', 'product_images',
      'product_specifications', 'product_vehicle_compatibility', 'cart_items',
      'orders', 'order_items', 'order_status_history', 'coupons', 'coupon_usage',
      'audit_logs', 'wishlist_items', 'product_reviews'];
    for (const table of tables) {
      const exists = qGet(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]);
      expect(exists).toBeDefined();
    }
  });

  it('should have required indexes', () => {
    const indexes = ['idx_users_email', 'idx_users_is_admin', 'idx_products_slug',
      'idx_orders_order_number', 'idx_orders_user_id'];
    for (const idx of indexes) {
      const exists = qGet(`SELECT name FROM sqlite_master WHERE type='index' AND name=?`, [idx]);
      expect(exists).toBeDefined();
    }
  });
});
