import { Router, Request, Response } from 'express';
import { qGet, qAll, qRun, transaction, prepare } from '../db/index.js';
import { authRequired, adminRequired, validateBody, validateQuery, validateParams } from '../middleware/index.js';
import { z } from 'zod';
import { generateOrderNumber, formatPkrCompact, formatDateTime } from '../utils/helpers.js';
import { hashPassword } from '../auth/index.js';
import { config } from '../config/index.js';

const router = Router();

// Apply admin auth to all routes
router.use(authRequired);
router.use(adminRequired);

// ============================================================
// DASHBOARD
// ============================================================
router.get('/dashboard', async (req: Request, res: Response) => {
  try {

    const stats = {
      total_orders: (qGet('SELECT COUNT(*) as c FROM orders', []) as { c: number })?.c ?? 0,
      total_revenue: (qGet('SELECT COALESCE(SUM(total_amount), 0) as c FROM orders WHERE status != "cancelled"', []) as { c: number })?.c ?? 0,
      total_products: (qGet('SELECT COUNT(*) as c FROM products WHERE is_active = 1', []) as { c: number })?.c ?? 0,
      low_stock_products: (qGet('SELECT COUNT(*) as c FROM products WHERE is_active = 1 AND stock_quantity <= low_stock_threshold AND stock_quantity > 0', []) as { c: number })?.c ?? 0,
      out_of_stock_products: (qGet('SELECT COUNT(*) as c FROM products WHERE is_active = 1 AND stock_quantity = 0', []) as { c: number })?.c ?? 0,
      pending_orders: (qGet('SELECT COUNT(*) as c FROM orders WHERE status = "pending"', []) as { c: number })?.c ?? 0,
      total_customers: (qGet('SELECT COUNT(*) as c FROM users WHERE is_admin = 0', []) as { c: number })?.c ?? 0,
    };

    const recentOrders = qAll(`
      SELECT o.id, o.order_number, o.status, o.total_amount, o.created_at,
             u.email, u.first_name, u.last_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `, []);

    const topProducts = prepare(`
      SELECT p.id, p.name, p.sku, p.stock_quantity,
             COALESCE(SUM(oi.quantity), 0) as total_sold,
             COALESCE(SUM(oi.line_total), 0) as revenue
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id AND o.status != 'cancelled'
      WHERE p.is_active = 1
      GROUP BY p.id
      ORDER BY total_sold DESC
      LIMIT 10
    `).all();

    res.json({
      stats: {
        total_orders: stats.total_orders,
        total_revenue: stats.total_revenue,
        total_revenue_formatted: formatPkrCompact(stats.total_revenue),
        total_products: stats.total_products,
        low_stock_products: stats.low_stock_products,
        out_of_stock_products: stats.out_of_stock_products,
        pending_orders: stats.pending_orders,
        total_customers: stats.total_customers,
      },
      recent_orders: recentOrders.map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        total_amount: o.total_amount,
        total_formatted: formatPkrCompact(o.total_amount),
        customer: o.email ? `${o.first_name} ${o.last_name} (${o.email})` : 'Guest',
        created_at: o.created_at,
        created_at_formatted: formatDateTime(o.created_at),
      })),
      top_products: topProducts.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock_quantity: p.stock_quantity,
        total_sold: p.total_sold,
        revenue: p.revenue,
        revenue_formatted: formatPkrCompact(p.revenue),
      })),
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================
// PRODUCTS MANAGEMENT
// ============================================================
const productQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  low_stock: z.coerce.boolean().optional(),
});

const productCreateSchema = z.object({
  sku: z.string().min(3).max(50),
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(200).optional(),
  description: z.string().optional(),
  short_description: z.string().optional(),
  price: z.number().int().positive(), // in paisa
  sale_price: z.number().int().positive().optional(),
  cost_price: z.number().int().nonnegative().optional(),
  stock_quantity: z.number().int().nonnegative().default(0),
  low_stock_threshold: z.number().int().positive().default(5),
  weight_grams: z.number().int().positive().optional(),
  condition: z.enum(['new', 'refurbished', 'used']).default('new'),
  warranty_months: z.number().int().positive().optional(),
  category_id: z.number().int().positive().optional(),
  brand_id: z.number().int().positive().optional(),
  is_featured: z.boolean().default(false),
  specifications: z.array(z.object({
    key: z.string(),
    value: z.string(),
  })).optional(),
  compatibility: z.array(z.object({
    variant_id: z.number().int().positive(),
    notes: z.string().optional(),
  })).optional(),
});

const productUpdateSchema = productCreateSchema.partial();

router.get('/products', validateQuery(productQuerySchema), async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const search = query.search;
    const category = query.category;
    const brand = query.brand;
    const status = query.status;
    const low_stock = query.low_stock === 'true';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      whereClause += ' AND c.slug = ?';
      params.push(category);
    }
    if (brand) {
      whereClause += ' AND b.slug = ?';
      params.push(brand);
    }
    if (status === 'active') {
      whereClause += ' AND p.is_active = 1';
    } else if (status === 'inactive') {
      whereClause += ' AND p.is_active = 0';
    }
    if (low_stock) {
      whereClause += ' AND p.stock_quantity <= p.low_stock_threshold AND p.stock_quantity > 0';
    }

    const countSql = `
      SELECT COUNT(*) as total FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      ${whereClause}
    `;
    const totalResult = qGet(countSql, [...params]) as { total: number };

    const productsSql = `
      SELECT p.*, c.name as category_name, b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const products = qAll(productsSql, [...params, limit, offset]);

    res.json({
      products: products.map((p: any) => ({
        ...p,
        price_formatted: formatPkrCompact(p.price),
        sale_price_formatted: p.sale_price ? formatPkrCompact(p.sale_price) : null,
        effective_price_formatted: formatPkrCompact(p.sale_price ?? p.price),
      })),
      pagination: {
        page, limit, total: totalResult.total,
        total_pages: Math.ceil(totalResult.total / limit),
      },
    });
  } catch (error) {
    console.error('Admin get products error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/products/:id', validateParams(z.object({ id: z.string().regex(/^\d+$/) })), async (req: Request, res: Response) => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

    const product = qGet('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ error: 'Not Found' });
    }

    const images = qAll('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order', [id]);
    const specs = qAll('SELECT * FROM product_specifications WHERE product_id = ? ORDER BY sort_order', [id]);
    const compat = qAll(`
      SELECT pvc.*, vv.year, vv.engine, vm.name as model_name, vma.name as make_name
      FROM product_vehicle_compatibility pvc
      JOIN vehicle_variants vv ON pvc.variant_id = vv.id
      JOIN vehicle_models vm ON vv.model_id = vm.id
      JOIN vehicle_makes vma ON vm.make_id = vma.id
      WHERE pvc.product_id = ?
    `, [id]);

    res.json({
      product: { ...product, images, specifications: specs, compatibility: compat },
    });
  } catch (error) {
    console.error('Admin get product error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/products', validateBody(productCreateSchema), async (req: Request, res: Response) => {
  try {
    const data = req.body;

    // Check SKU unique
    const existing = qGet('SELECT id FROM products WHERE sku = ?', [data.sku]);
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'SKU already exists' });
    }

    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    const result = qRun(`
      INSERT INTO products (sku, name, slug, description, short_description, price, sale_price, cost_price,
        stock_quantity, low_stock_threshold, weight_grams, condition, warranty_months,
        category_id, brand_id, is_featured, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime("now"), datetime("now"))
    `, [
      data.sku, data.name, slug, data.description || null, data.short_description || null,
      data.price, data.sale_price || null, data.cost_price || null,
      data.stock_quantity, data.low_stock_threshold, data.weight_grams || null,
      data.condition, data.warranty_months || null,
      data.category_id || null, data.brand_id || null, data.is_featured ? 1 : 0
    ]);

    const productId = result.lastInsertRowid as number;

    // Add specifications
    if (data.specifications) {
      const specInsert = prepare('INSERT INTO product_specifications (product_id, spec_key, spec_value, sort_order) VALUES (?, ?, ?, ?)');
      data.specifications.forEach((s: any, i: number) => specInsert.run(productId, s.key, s.value, i));
    }

    // Add compatibility
    if (data.compatibility) {
      const compatInsert = prepare('INSERT OR IGNORE INTO product_vehicle_compatibility (product_id, variant_id, notes) VALUES (?, ?, ?)');
      for (const c of data.compatibility) {
        compatInsert.run(productId, c.variant_id, c.notes || null);
      }
    }

    // Audit log
    const session = (req as any).session;
    prepare('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data) VALUES (?, ?, ?, ?, ?)')
      .run(session.userId, 'create', 'product', productId, JSON.stringify(data));

    res.status(201).json({ success: true, product_id: productId });
  } catch (error) {
    console.error('Admin create product error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/products/:id', validateParams(z.object({ id: z.string().regex(/^\d+$/) })), validateBody(productUpdateSchema), async (req: Request, res: Response) => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const data = req.body;

    const product = qGet('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ error: 'Not Found' });
    }

    // Check SKU unique if changed
    if (data.sku && data.sku !== (product as any).sku) {
      const existing = qGet('SELECT id FROM products WHERE sku = ? AND id != ?', [data.sku, id]);
      if (existing) {
        return res.status(409).json({ error: 'Conflict', message: 'SKU already exists' });
      }
    }

    const fields: string[] = [];
    const values: any[] = [];

    const allowedFields = ['sku', 'name', 'slug', 'description', 'short_description', 'price', 'sale_price', 'cost_price',
      'stock_quantity', 'low_stock_threshold', 'weight_grams', 'condition', 'warranty_months',
      'category_id', 'brand_id', 'is_featured', 'is_active'];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (fields.length > 0) {
      fields.push('updated_at = datetime("now")');
      values.push(id);
      qRun(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, [...values]);
    }

    // Update specifications if provided
    if (data.specifications) {
      qRun('DELETE FROM product_specifications WHERE product_id = ?', [id]);
      const specInsert = prepare('INSERT INTO product_specifications (product_id, spec_key, spec_value, sort_order) VALUES (?, ?, ?, ?)');
      data.specifications.forEach((s: any, i: number) => specInsert.run(id, s.key, s.value, i));
    }

    // Update compatibility if provided
    if (data.compatibility) {
      qRun('DELETE FROM product_vehicle_compatibility WHERE product_id = ?', [id]);
      const compatInsert = prepare('INSERT OR IGNORE INTO product_vehicle_compatibility (product_id, variant_id, notes) VALUES (?, ?, ?)');
      for (const c of data.compatibility) {
        compatInsert.run(id, c.variant_id, c.notes || null);
      }
    }

    // Audit log
    const session = (req as any).session;
    prepare('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data) VALUES (?, ?, ?, ?, ?, ?)')
      .run(session.userId, 'update', 'product', id, JSON.stringify(product), JSON.stringify(data));

    res.json({ success: true, message: 'Product updated' });
  } catch (error) {
    console.error('Admin update product error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/products/:id', validateParams(z.object({ id: z.string().regex(/^\d+$/) })), async (req: Request, res: Response) => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

    const product = qGet('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ error: 'Not Found' });
    }

    // Soft delete
    qRun('UPDATE products SET is_active = 0, updated_at = datetime("now") WHERE id = ?', [id]);

    const session = (req as any).session;
    prepare('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data) VALUES (?, ?, ?, ?, ?)')
      .run(session.userId, 'delete', 'product', id, JSON.stringify(product));

    res.json({ success: true, message: 'Product deactivated' });
  } catch (error) {
    console.error('Admin delete product error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================
// CATEGORIES
// ============================================================
const categoryCreateSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  parent_id: z.number().int().positive().optional(),
  sort_order: z.number().int().default(0),
});

router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = qAll('SELECT * FROM categories ORDER BY sort_order, name', []);
    res.json({ categories });
  } catch (error) {
    console.error('Admin get categories error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/categories', validateBody(categoryCreateSchema), async (req: Request, res: Response) => {
  try {
    const data = req.body;

    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    const result = prepare('INSERT INTO categories (name, slug, description, parent_id, sort_order) VALUES (?, ?, ?, ?, ?)')
      .run(data.name, slug, data.description || null, data.parent_id || null, data.sort_order || 0);

    res.status(201).json({ success: true, category_id: result.lastInsertRowid });
  } catch (error) {
    console.error('Admin create category error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/categories/:id', validateParams(z.object({ id: z.string().regex(/^\d+$/) })), validateBody(categoryCreateSchema.partial()), async (req: Request, res: Response) => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const data = req.body;

    const fields: string[] = [];
    const values: any[] = [];

    for (const field of ['name', 'slug', 'description', 'parent_id', 'sort_order', 'is_active']) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (fields.length > 0) {
      fields.push('updated_at = datetime("now")');
      values.push(id);
      qRun(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, [...values]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Admin update category error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================
// BRANDS
// ============================================================
const brandCreateSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  website_url: z.string().url().optional().or(z.literal('')),
});

router.get('/brands', async (req: Request, res: Response) => {
  try {
    const brands = qAll('SELECT * FROM brands ORDER BY name', []);
    res.json({ brands });
  } catch (error) {
    console.error('Admin get brands error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/brands', validateBody(brandCreateSchema), async (req: Request, res: Response) => {
  try {
    const data = req.body;

    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    const result = prepare('INSERT INTO brands (name, slug, description, website_url) VALUES (?, ?, ?, ?)')
      .run(data.name, slug, data.description || null, data.website_url || null);

    res.status(201).json({ success: true, brand_id: result.lastInsertRowid });
  } catch (error) {
    console.error('Admin create brand error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================
// VEHICLES
// ============================================================
router.get('/vehicles/makes', async (req: Request, res: Response) => {
  try {
    const makes = qAll('SELECT * FROM vehicle_makes ORDER BY name', []);
    res.json({ makes });
  } catch (error) {
    console.error('Admin get makes error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/vehicles/makes', validateBody(z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50).optional(),
})), async (req: Request, res: Response) => {
  try {
    const { name, slug } = req.body;

    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const result = qRun('INSERT INTO vehicle_makes (name, slug) VALUES (?, ?)', [name, finalSlug]);

    res.status(201).json({ success: true, make_id: result.lastInsertRowid });
  } catch (error) {
    console.error('Admin create make error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/vehicles/models', async (req: Request, res: Response) => {
  try {
    const models = qAll(`
      SELECT vm.*, vma.name as make_name, vma.slug as make_slug
      FROM vehicle_models vm
      JOIN vehicle_makes vma ON vm.make_id = vma.id
      ORDER BY vma.name, vm.name
    `, []);
    res.json({ models });
  } catch (error) {
    console.error('Admin get models error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/vehicles/models', validateBody(z.object({
  make_id: z.number().int().positive(),
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
})), async (req: Request, res: Response) => {
  try {
    const { make_id, name, slug, description } = req.body;

    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const result = prepare('INSERT INTO vehicle_models (make_id, name, slug, description) VALUES (?, ?, ?, ?)')
      .run(make_id, name, finalSlug, description || null);

    res.status(201).json({ success: true, model_id: result.lastInsertRowid });
  } catch (error) {
    console.error('Admin create model error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/vehicles/variants', async (req: Request, res: Response) => {
  try {
    const variants = qAll(`
      SELECT vv.*, vm.name as model_name, vm.slug as model_slug, vma.name as make_name, vma.slug as make_slug
      FROM vehicle_variants vv
      JOIN vehicle_models vm ON vv.model_id = vm.id
      JOIN vehicle_makes vma ON vm.make_id = vma.id
      ORDER BY vma.name, vm.name, vv.year DESC
    `, []);
    res.json({ variants });
  } catch (error) {
    console.error('Admin get variants error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/vehicles/variants', validateBody(z.object({
  model_id: z.number().int().positive(),
  year: z.number().int().min(1990).max(2030),
  engine: z.string().optional(),
  transmission: z.string().optional(),
  fuel_type: z.string().optional(),
  body_type: z.string().optional(),
})), async (req: Request, res: Response) => {
  try {
    const data = req.body;

    const result = qRun(`
      INSERT INTO vehicle_variants (model_id, year, engine, transmission, fuel_type, body_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [data.model_id, data.year, data.engine || null, data.transmission || null, data.fuel_type || null, data.body_type || null]);

    res.status(201).json({ success: true, variant_id: result.lastInsertRowid });
  } catch (error) {
    console.error('Admin create variant error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================
// ORDERS MANAGEMENT
// ============================================================
const adminOrderQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().optional(),
  search: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

router.get('/orders', validateQuery(adminOrderQuerySchema), async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const status = query.status;
    const search = query.search;
    const date_from = query.date_from;
    const date_to = query.date_to;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }
    if (search) {
      whereClause += ' AND (o.order_number LIKE ? OR o.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (date_from) {
      whereClause += ' AND date(o.created_at) >= date(?)';
      params.push(date_from);
    }
    if (date_to) {
      whereClause += ' AND date(o.created_at) <= date(?)';
      params.push(date_to);
    }

    const countSql = `SELECT COUNT(*) as total FROM orders o LEFT JOIN users u ON o.user_id = u.id ${whereClause}`;
    const totalResult = qGet(countSql, [...params]) as { total: number };

    const ordersSql = `
      SELECT o.*, u.first_name, u.last_name, u.email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const orders = qAll(ordersSql, [...params, limit, offset]);

    res.json({
      orders: orders.map((o: any) => ({
        ...o,
        total_formatted: formatPkrCompact(o.total_amount),
        customer_name: o.first_name ? `${o.first_name} ${o.last_name}` : 'Guest',
        created_at_formatted: formatDateTime(o.created_at),
      })),
      pagination: { page, limit, total: totalResult.total, total_pages: Math.ceil(totalResult.total / limit) },
    });
  } catch (error) {
    console.error('Admin get orders error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/orders/:id', validateParams(z.object({ id: z.string().regex(/^\d+$/) })), async (req: Request, res: Response) => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

    const order = qGet(`
      SELECT o.*, u.first_name, u.last_name, u.email, u.phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `, [id]) as {
      id: number;
      order_number: string;
      status: string;
      total_amount: number;
      shipping_address: string;
      billing_address: string | null;
      first_name: string | null;
      last_name: string | null;
      email: string;
      phone: string;
      created_at: string;
      updated_at: string;
      confirmed_at: string | null;
      shipped_at: string | null;
      delivered_at: string | null;
      cancelled_at: string | null;
      notes: string | null;
    } | undefined;

    if (!order) {
      return res.status(404).json({ error: 'Not Found' });
    }

    const items = qAll('SELECT * FROM order_items WHERE order_id = ?', [id]) as any[];
    const history = qAll(`
      SELECT osh.*, u.first_name, u.last_name
      FROM order_status_history osh
      LEFT JOIN users u ON osh.changed_by = u.id
      WHERE osh.order_id = ?
      ORDER BY osh.created_at ASC
    `, [id]) as any[];

    res.json({
      order: {
        ...order,
        total_formatted: formatPkrCompact(order.total_amount),
        shipping_address: JSON.parse(order.shipping_address),
        billing_address: JSON.parse(order.billing_address || '{}'),
        customer_name: order.first_name ? `${order.first_name} ${order.last_name}` : 'Guest',
        items,
        status_history: history,
      },
    });
  } catch (error) {
    console.error('Admin get order error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const orderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled']),
  notes: z.string().optional(),
});

const validTransitions: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

router.put('/orders/:id/status', validateParams(z.object({ id: z.string().regex(/^\d+$/) })), validateBody(orderStatusSchema), async (req: Request, res: Response) => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const { status, notes } = req.body;

    const order = qGet('SELECT * FROM orders WHERE id = ?', [id]) as { id: number; status: string } | undefined;
    if (!order) {
      return res.status(404).json({ error: 'Not Found' });
    }

    const currentStatus = order.status;
    if (!validTransitions[currentStatus]?.includes(status)) {
      return res.status(400).json({ error: 'Bad Request', message: `Cannot transition from ${currentStatus} to ${status}` });
    }

    const session = (req as any).session;
    const now = new Date().toISOString();

    transaction(() => {
      const updates: string[] = ['status = ?', 'updated_at = datetime("now")'];
      const values: any[] = [status];

      if (status === 'confirmed') { updates.push('confirmed_at = ?'); values.push(now); }
      if (status === 'shipped') { updates.push('shipped_at = ?'); values.push(now); }
      if (status === 'delivered') { updates.push('delivered_at = ?'); values.push(now); }
      if (status === 'cancelled') { updates.push('cancelled_at = ?'); values.push(now); }

      values.push(id);
      qRun(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, [...values]);

      prepare('INSERT INTO order_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)')
        .run(id, status, notes || null, session.userId);

      // Restore stock if cancelled
      if (status === 'cancelled' && currentStatus !== 'cancelled') {
        const items = qAll('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [id]) as { product_id: number; quantity: number }[];
        for (const item of items) {
          prepare('UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = datetime("now") WHERE id = ?')
            .run(item.quantity, item.product_id);
        }
      }
    });

    res.json({ success: true, message: `Order status updated to ${status}` });
  } catch (error) {
    console.error('Admin update order status error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================
// CUSTOMERS
// ============================================================
const customerQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

router.get('/customers', validateQuery(customerQuerySchema), async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const search = query.search;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE is_admin = 0';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countSql = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const totalResult = qGet(countSql, [...params]) as { total: number };

    const usersSql = `SELECT id, email, first_name, last_name, phone, is_active, email_verified, created_at FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const users = qAll(usersSql, [...params, limit, offset]) as { id: number; email: string; first_name: string; last_name: string; phone: string | null; is_active: number; email_verified: number; created_at: string }[];

    // Get order counts
    for (const user of users) {
      const orderStats = qGet('SELECT COUNT(*) as c, COALESCE(SUM(total_amount), 0) as total FROM orders WHERE user_id = ?', [user.id]) as { c: number; total: number };
      (user as any).order_count = orderStats.c;
      (user as any).total_spent = orderStats.total;
      (user as any).total_spent_formatted = formatPkrCompact(orderStats.total);
    }

    res.json({
      customers: users,
      pagination: { page, limit, total: totalResult.total, total_pages: Math.ceil(totalResult.total / limit) },
    });
  } catch (error) {
    console.error('Admin get customers error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================
// COUPONS
// ============================================================
const couponCreateSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
  description: z.string().optional(),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number().int().positive(),
  min_order_amount: z.number().int().nonnegative().default(0),
  max_discount_amount: z.number().int().positive().optional(),
  usage_limit: z.number().int().positive().optional(),
  user_limit: z.number().int().positive().default(1),
  expires_at: z.string().optional(),
});

router.get('/coupons', async (req: Request, res: Response) => {
  try {
    const coupons = qAll('SELECT * FROM coupons ORDER BY created_at DESC', []);
    res.json({ coupons });
  } catch (error) {
    console.error('Admin get coupons error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/coupons', validateBody(couponCreateSchema), async (req: Request, res: Response) => {
  try {
    const data = req.body;

    const existing = qGet('SELECT id FROM coupons WHERE code = ?', [data.code]);
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'Coupon code already exists' });
    }

    const result = qRun(`
      INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, user_limit, expires_at, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime("now"))
    `, [data.code, data.description || null, data.discount_type, data.discount_value,
      data.min_order_amount, data.max_discount_amount || null, data.usage_limit || null,
      data.user_limit, data.expires_at || null]);

    res.status(201).json({ success: true, coupon_id: result.lastInsertRowid });
  } catch (error) {
    console.error('Admin create coupon error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/coupons/:id', validateParams(z.object({ id: z.string().regex(/^\d+$/) })), validateBody(couponCreateSchema.partial()), async (req: Request, res: Response) => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const data = req.body;

    const fields: string[] = [];
    const values: any[] = [];

    for (const field of ['code', 'description', 'discount_type', 'discount_value', 'min_order_amount',
      'max_discount_amount', 'usage_limit', 'user_limit', 'expires_at', 'is_active']) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (fields.length > 0) {
      fields.push('updated_at = datetime("now")');
      values.push(id);
      qRun(`UPDATE coupons SET ${fields.join(', ')} WHERE id = ?`, [...values]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Admin update coupon error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================
// REPORTS
// ============================================================
router.get('/reports/sales', async (req: Request, res: Response) => {
  try {
    const { period = 'month', limit = '12' } = req.query;

    let dateFormat: string;
    let groupBy: string;

    switch (period) {
      case 'day': dateFormat = '%Y-%m-%d'; groupBy = 'date(created_at)'; break;
      case 'week': dateFormat = '%Y-%W'; groupBy = 'strftime("%Y-%W", created_at)'; break;
      case 'month': default: dateFormat = '%Y-%m'; groupBy = 'strftime("%Y-%m", created_at)'; break;
    }

    const sales = qAll(`
      SELECT strftime(?, created_at) as period,
             COUNT(*) as order_count,
             COALESCE(SUM(total_amount), 0) as revenue
      FROM orders
      WHERE status != 'cancelled'
      GROUP BY strftime(?, created_at)
      ORDER BY period DESC
      LIMIT ?
    `, [dateFormat, dateFormat, parseInt(limit as string)]);

    res.json({ sales: sales.map((s: any) => ({ ...s, revenue_formatted: formatPkrCompact(s.revenue) })) });
  } catch (error) {
    console.error('Admin sales report error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/reports/inventory', async (req: Request, res: Response) => {
  try {

    const inventory = qAll(`
      SELECT
        p.id, p.sku, p.name, p.stock_quantity, p.low_stock_threshold,
        p.price, p.sale_price, c.name as category, b.name as brand,
        CASE
          WHEN p.stock_quantity = 0 THEN 'out_of_stock'
          WHEN p.stock_quantity <= p.low_stock_threshold THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.is_active = 1
      ORDER BY p.stock_quantity ASC
    `, []);

    res.json({ inventory });
  } catch (error) {
    console.error('Admin inventory report error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;