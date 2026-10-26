import { Router, Request, Response } from 'express';
import { qGet, qAll, qRun, prepare } from '../db/index.js';
import { validateQuery, validateBody, validateParams } from '../middleware/index.js';
import { z } from 'zod';
import { formatPkrCompact } from '../utils/helpers.js';
import { getDb } from '../db/index.js';

const router = Router();

// Validation schemas
const productQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: z.string().optional(),
  brand: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest', 'popular', 'name_asc', 'name_desc']).default('newest'),
  min_price: z.coerce.number().int().nonnegative().optional(),
  max_price: z.coerce.number().int().nonnegative().optional(),
  in_stock: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  vehicle_make: z.string().optional(),
  vehicle_model: z.string().optional(),
  vehicle_year: z.coerce.number().int().optional(),
});

const productParamsSchema = z.object({
  idOrSlug: z.string().min(1),
});

const vehicleCompatibilityQuerySchema = z.object({
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().int().optional(),
  engine: z.string().optional(),
});

const addToCartSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive().max(99).default(1),
});

// GET /api/products - List products with filters
router.get('/', validateQuery(productQuerySchema), async (req: Request, res: Response) => {
  try {
    const query = (req as any).validatedQuery || req.query;
    const page = Math.max(parseInt(query.page as string) || 1, 1);
    const limit = Math.min(parseInt(query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const category = query.category as string | undefined;
    const brand = query.brand as string | undefined;
    const search = query.search as string | undefined;
    const sort = query.sort as string | undefined;
    const min_price = query.min_price !== undefined ? parseInt(query.min_price as string) : undefined;
    const max_price = query.max_price !== undefined ? parseInt(query.max_price as string) : undefined;
    const in_stock = query.in_stock === 'true';
    const featured = query.featured === 'true';
    const vehicle_make = query.vehicle_make as string | undefined;
    const vehicle_model = query.vehicle_model as string | undefined;
    const vehicle_year = query.vehicle_year !== undefined ? parseInt(query.vehicle_year as string) : undefined;

    let whereClause = 'WHERE p.is_active = 1';
    const params: any[] = [];

    if (category) {
      whereClause += ' AND c.slug = ?';
      params.push(category);
    }
    if (brand) {
      whereClause += ' AND b.slug = ?';
      params.push(brand);
    }
    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    if (min_price !== undefined) {
      whereClause += ' AND COALESCE(p.sale_price, p.price) >= ?';
      params.push(min_price);
    }
    if (max_price !== undefined) {
      whereClause += ' AND COALESCE(p.sale_price, p.price) <= ?';
      params.push(max_price);
    }
    if (in_stock) {
      whereClause += ' AND p.stock_quantity > 0';
    }
    if (featured) {
      whereClause += ' AND p.is_featured = 1';
    }

    // Vehicle compatibility filter
    if (vehicle_make || vehicle_model || vehicle_year) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM product_vehicle_compatibility pvc
        JOIN vehicle_variants vv ON pvc.variant_id = vv.id
        JOIN vehicle_models vm ON vv.model_id = vm.id
        JOIN vehicle_makes vma ON vm.make_id = vma.id
        WHERE pvc.product_id = p.id
        ${vehicle_make ? 'AND vma.slug = ?' : ''}
        ${vehicle_model ? 'AND vm.slug = ?' : ''}
        ${vehicle_year ? 'AND vv.year = ?' : ''}
      )`;
      if (vehicle_make) params.push(vehicle_make);
      if (vehicle_model) params.push(vehicle_model);
      if (vehicle_year) params.push(vehicle_year);
    }

    let orderBy = 'p.created_at DESC';
    switch (sort) {
      case 'price_asc': orderBy = 'COALESCE(p.sale_price, p.price) ASC'; break;
      case 'price_desc': orderBy = 'COALESCE(p.sale_price, p.price) DESC'; break;
      case 'name_asc': orderBy = 'p.name ASC'; break;
      case 'name_desc': orderBy = 'p.name DESC'; break;
      case 'popular': orderBy = 'p.stock_quantity DESC'; break;
      case 'newest':
      default: orderBy = 'p.created_at DESC';
    }

    // Count total
    const countSql = `
      SELECT COUNT(*) as total FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      ${whereClause}
    `;
    const db = getDb();
    const totalStmt = db.prepare(countSql);
    totalStmt.bind([...params]);
    const totalResult = totalStmt.step() ? totalStmt.getAsObject() as { total: number } : { total: 0 };
    totalStmt.free();
    const total = totalResult?.total ?? 0;

    // Get products
    const productsSql = `
      SELECT
        p.id, p.sku, p.name, p.slug, p.short_description,
        p.price, p.sale_price, p.stock_quantity, p.condition,
        p.warranty_months, p.is_featured,
        c.name as category_name, c.slug as category_slug,
        b.name as brand_name, b.slug as brand_slug,
        (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const productsStmt = db.prepare(productsSql);
    productsStmt.bind([...params, limit, offset]);
    const products = [];
    while (productsStmt.step()) {
      products.push(productsStmt.getAsObject());
    }
    productsStmt.free();

    const formattedProducts = products.map((p: any) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      slug: p.slug,
      short_description: p.short_description,
      price: p.price,
      sale_price: p.sale_price,
      effective_price: p.sale_price ?? p.price,
      price_formatted: formatPkrCompact(p.sale_price ?? p.price),
      original_price_formatted: p.sale_price ? formatPkrCompact(p.price) : null,
      stock_quantity: p.stock_quantity,
      in_stock: p.stock_quantity > 0,
      condition: p.condition,
      warranty_months: p.warranty_months,
      is_featured: p.is_featured === 1,
      category: p.category_name ? { name: p.category_name, slug: p.category_slug } : null,
      brand: p.brand_name ? { name: p.brand_name, slug: p.brand_slug } : null,
      primary_image: p.primary_image,
      discount_percent: p.sale_price ? Math.round(((p.price - p.sale_price) / p.price) * 100) : 0,
    }));

    res.json({
      products: formattedProducts,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_next: page < Math.ceil(total / limit),
        has_prev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error instanceof Error ? error.message : String(error) });
  }
});

// GET /api/products/featured - Get featured products
router.get('/featured', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 8, 20);

    const products = qAll(`
      SELECT
        p.id, p.sku, p.name, p.slug, p.short_description,
        p.price, p.sale_price, p.stock_quantity,
        c.slug as category_slug,
        b.name as brand_name,
        (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.is_active = 1 AND p.stock_quantity > 0
      ORDER BY p.created_at DESC
      LIMIT ?
    `, [limit]);

    const formatted = products.map((p: any) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      slug: p.slug,
      short_description: p.short_description,
      price: p.price,
      sale_price: p.sale_price,
      effective_price: p.sale_price ?? p.price,
      price_formatted: formatPkrCompact(p.sale_price ?? p.price),
      stock_quantity: p.stock_quantity,
      in_stock: p.stock_quantity > 0,
      category_slug: p.category_slug,
      brand_name: p.brand_name,
      primary_image: p.primary_image,
      discount_percent: p.sale_price ? Math.round(((p.price - p.sale_price) / p.price) * 100) : 0,
    }));

    res.json({ products: formatted });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/products/new-arrivals - Get new arrivals
router.get('/new-arrivals', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 8, 20);

    const products = qAll(`
      SELECT
        p.id, p.sku, p.name, p.slug, p.short_description,
        p.price, p.sale_price, p.stock_quantity,
        c.slug as category_slug,
        b.name as brand_name,
        (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.is_active = 1 AND p.stock_quantity > 0
      ORDER BY p.created_at DESC
      LIMIT ?
    `, [limit]);

    const formatted = products.map((p: any) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      slug: p.slug,
      short_description: p.short_description,
      price: p.price,
      sale_price: p.sale_price,
      effective_price: p.sale_price ?? p.price,
      price_formatted: formatPkrCompact(p.sale_price ?? p.price),
      stock_quantity: p.stock_quantity,
      in_stock: p.stock_quantity > 0,
      category_slug: p.category_slug,
      brand_name: p.brand_name,
      primary_image: p.primary_image,
      discount_percent: p.sale_price ? Math.round(((p.price - p.sale_price) / p.price) * 100) : 0,
    }));

    res.json({ products: formatted });
  } catch (error) {
    console.error('Error fetching new arrivals:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/products/categories - Get all categories with product counts
router.get('/categories', async (req: Request, res: Response) => {
  try {

    const categories = qAll(`
      SELECT
        c.id, c.name, c.slug, c.description, c.image_url,
        COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
      WHERE c.is_active = 1
      GROUP BY c.id
      ORDER BY c.sort_order, c.name
    `, []);

    res.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error instanceof Error ? error.message : String(error) });
  }
});

// GET /api/products/brands - Get all brands
router.get('/brands', async (req: Request, res: Response) => {
  try {

    const brands = qAll(`
      SELECT
        b.id, b.name, b.slug, b.description, b.logo_url,
        COUNT(p.id) as product_count
      FROM brands b
      LEFT JOIN products p ON p.brand_id = b.id AND p.is_active = 1
      WHERE b.is_active = 1
      GROUP BY b.id
      ORDER BY b.name
    `, []);

    res.json({ brands });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/products/search/suggestions - Search suggestions
router.get('/search/suggestions', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q || q.length < 2) {
      return res.json({ suggestions: [] });
    }
    const suggestions = qAll(`
      SELECT DISTINCT name FROM products
      WHERE is_active = 1 AND name LIKE ?
      LIMIT 10
    `, [`%${q}%`]);

    res.json({ suggestions: suggestions.map((s: any) => s.name) });
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/products/:idOrSlug - Get single product
router.get('/:idOrSlug', validateParams(productParamsSchema), async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;

    const idOrSlugStr = Array.isArray(idOrSlug) ? idOrSlug[0] : idOrSlug;
    const isNumeric = /^\d+$/.test(idOrSlugStr);
    const product = qGet(`
      SELECT
        p.*, c.name as category_name, c.slug as category_slug,
        b.name as brand_name, b.slug as brand_slug, b.description as brand_description, b.logo_url as brand_logo
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.is_active = 1 AND ${isNumeric ? 'p.id = ?' : 'p.slug = ?'}
    `, [idOrSlugStr]) as {
      id: number;
      sku: string;
      name: string;
      slug: string;
      description: string | null;
      short_description: string | null;
      price: number;
      sale_price: number | null;
      stock_quantity: number;
      low_stock_threshold: number;
      condition: string;
      warranty_months: number | null;
      weight_grams: number | null;
      dimensions: string | null;
      is_featured: number;
      category_id: number | null;
      brand_id: number | null;
      created_at: string;
      category_name: string | null;
      category_slug: string | null;
      brand_name: string | null;
      brand_slug: string | null;
      brand_description: string | null;
      brand_logo: string | null;
    } | undefined;

    if (!product) {
      return res.status(404).json({ error: 'Not Found', message: 'Product not found' });
    }

    // Get images
    const images = qAll(`
      SELECT id, url, alt_text, sort_order, is_primary
      FROM product_images
      WHERE product_id = ?
      ORDER BY sort_order, is_primary DESC
    `, [product.id]);

    // Get specifications
    const specifications = qAll(`
      SELECT spec_key, spec_value
      FROM product_specifications
      WHERE product_id = ?
      ORDER BY sort_order
    `, [product.id]);

    // Get vehicle compatibility
    const compatibility = qAll(`
      SELECT
        pvc.id, pvc.notes, pvc.verified,
        vv.year, vv.engine, vv.transmission, vv.fuel_type, vv.body_type,
        vm.name as model_name, vm.slug as model_slug,
        vma.name as make_name, vma.slug as make_slug
      FROM product_vehicle_compatibility pvc
      JOIN vehicle_variants vv ON pvc.variant_id = vv.id
      JOIN vehicle_models vm ON vv.model_id = vm.id
      JOIN vehicle_makes vma ON vm.make_id = vma.id
      WHERE pvc.product_id = ?
      ORDER BY vma.name, vm.name, vv.year DESC
    `, [product.id]) as { make_slug: string; model_slug: string; year: number; engine: string | null; transmission: string | null; fuel_type: string | null; body_type: string | null; notes: string | null; verified: number }[];

    // Group compatibility by make/model
    const compatByVehicle: Record<string, any[]> = {};
    for (const c of compatibility) {
      const key = `${c.make_slug}/${c.model_slug}`;
      if (!compatByVehicle[key]) {
        compatByVehicle[key] = [];
      }
      compatByVehicle[key].push({
        year: c.year,
        engine: c.engine,
        transmission: c.transmission,
        fuel_type: c.fuel_type,
        body_type: c.body_type,
        notes: c.notes,
        verified: c.verified === 1,
      });
    }

    const effectivePrice = product.sale_price ?? product.price;

    res.json({
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        slug: product.slug,
        description: product.description,
        short_description: product.short_description,
        price: product.price,
        sale_price: product.sale_price,
        effective_price: effectivePrice,
        price_formatted: formatPkrCompact(effectivePrice),
        original_price_formatted: product.sale_price ? formatPkrCompact(product.price) : null,
        stock_quantity: product.stock_quantity,
        in_stock: product.stock_quantity > 0,
        low_stock: product.stock_quantity > 0 && product.stock_quantity <= (product.low_stock_threshold || 5),
        condition: product.condition,
        warranty_months: product.warranty_months,
        weight_grams: product.weight_grams,
        dimensions: product.dimensions ? JSON.parse(product.dimensions) : null,
        is_featured: product.is_featured === 1,
        category: product.category_name ? { name: product.category_name, slug: product.category_slug } : null,
        brand: product.brand_name ? {
          name: product.brand_name,
          slug: product.brand_slug,
          description: product.brand_description,
          logo_url: product.brand_logo,
        } : null,
        images: images.map((img: any) => ({
          id: img.id,
          url: img.url,
          alt_text: img.alt_text,
          is_primary: img.is_primary === 1,
        })),
        specifications: specifications.map((s: any) => ({
          key: s.spec_key,
          value: s.spec_value,
        })),
        compatibility: Object.entries(compatByVehicle).map(([key, variants]) => {
          const [makeSlug, modelSlug] = key.split('/');
          return {
            make_slug: makeSlug,
            model_slug: modelSlug,
            variants,
          };
        }),
        discount_percent: product.sale_price ? Math.round(((product.price - product.sale_price) / product.price) * 100) : 0,
        created_at: product.created_at,
      },
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/products/:idOrSlug/related - Get related products
router.get('/:idOrSlug/related', validateParams(productParamsSchema), async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 4, 12);

    const idOrSlugStr = Array.isArray(idOrSlug) ? idOrSlug[0] : idOrSlug;
    const isNumeric = /^\d+$/.test(idOrSlugStr);
    const product = qGet(`
      SELECT id, category_id, brand_id FROM products
      WHERE is_active = 1 AND ${isNumeric ? 'id = ?' : 'slug = ?'}
    `, [idOrSlugStr]) as { id: number; category_id: number | null; brand_id: number | null } | undefined;

    if (!product) {
      return res.status(404).json({ error: 'Not Found' });
    }

    const related = qAll(`
      SELECT p.id, p.sku, p.name, p.slug, p.short_description, p.price, p.sale_price, p.stock_quantity,
             c.slug as category_slug, b.name as brand_name,
             (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image,
             p.weight_grams
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.is_active = 1 AND p.id != ?
        AND (p.category_id = ? OR p.brand_id = ?)
      ORDER BY p.created_at DESC
      LIMIT ?
    `, [product.id, product.category_id, product.brand_id, limit]);

    const formatted = related.map((p: any) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      slug: p.slug,
      short_description: p.short_description,
      price: p.price,
      sale_price: p.sale_price,
      effective_price: p.sale_price ?? p.price,
      price_formatted: formatPkrCompact(p.sale_price ?? p.price),
      stock_quantity: p.stock_quantity,
      in_stock: p.stock_quantity > 0,
      category_slug: p.category_slug,
      brand_name: p.brand_name,
      primary_image: p.primary_image,
      discount_percent: p.sale_price ? Math.round(((p.price - p.sale_price) / p.price) * 100) : 0,
    }));

    res.json({ products: formatted });
  } catch (error) {
    console.error('Error fetching related products:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Vehicle compatibility finder endpoints
router.get('/vehicles/makes', async (req: Request, res: Response) => {
  try {
    const makes = qAll(`
      SELECT id, name, slug, logo_url
      FROM vehicle_makes
      WHERE is_active = 1
      ORDER BY name
    `, []);
    res.json({ makes });
  } catch (error) {
    console.error('Error fetching vehicle makes:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/vehicles/makes/:makeSlug/models', async (req: Request, res: Response) => {
  try {
    const { makeSlug } = req.params;

    const make = qGet('SELECT id FROM vehicle_makes WHERE slug = ? AND is_active = 1', [makeSlug]);
    if (!make) {
      return res.status(404).json({ error: 'Not Found', message: 'Vehicle make not found' });
    }

    const models = qAll(`
      SELECT id, name, slug
      FROM vehicle_models
      WHERE make_id = ? AND is_active = 1
      ORDER BY name
    `, [(make as any).id]);

    res.json({ models });
  } catch (error) {
    console.error('Error fetching vehicle models:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/vehicles/models/:modelSlug/variants', async (req: Request, res: Response) => {
  try {
    const { modelSlug } = req.params;

    const model = qGet('SELECT id FROM vehicle_models WHERE slug = ? AND is_active = 1', [modelSlug]);
    if (!model) {
      return res.status(404).json({ error: 'Not Found', message: 'Vehicle model not found' });
    }

    const variants = qAll(`
      SELECT id, year, engine, transmission, fuel_type, body_type
      FROM vehicle_variants
      WHERE model_id = ? AND is_active = 1
      ORDER BY year DESC
    `, [(model as any).id]);

    res.json({ variants });
  } catch (error) {
    console.error('Error fetching vehicle variants:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/vehicles/compatible-products', validateQuery(vehicleCompatibilityQuerySchema), async (req: Request, res: Response) => {
  try {
    const { make, model, year, engine } = req.query as any;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE p.is_active = 1 AND p.stock_quantity > 0';
    const params: any[] = [];

    if (make) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM product_vehicle_compatibility pvc
        JOIN vehicle_variants vv ON pvc.variant_id = vv.id
        JOIN vehicle_models vm ON vv.model_id = vm.id
        JOIN vehicle_makes vma ON vm.make_id = vma.id
        WHERE pvc.product_id = p.id AND vma.slug = ?
      )`;
      params.push(make);
    }
    if (model) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM product_vehicle_compatibility pvc
        JOIN vehicle_variants vv ON pvc.variant_id = vv.id
        JOIN vehicle_models vm ON vv.model_id = vm.id
        WHERE pvc.product_id = p.id AND vm.slug = ?
      )`;
      params.push(model);
    }
    if (year) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM product_vehicle_compatibility pvc
        JOIN vehicle_variants vv ON pvc.variant_id = vv.id
        WHERE pvc.product_id = p.id AND vv.year = ?
      )`;
      params.push(year);
    }
    if (engine) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM product_vehicle_compatibility pvc
        JOIN vehicle_variants vv ON pvc.variant_id = vv.id
        WHERE pvc.product_id = p.id AND vv.engine = ?
      )`;
      params.push(engine);
    }

    const countSql = `SELECT COUNT(*) as total FROM products p ${whereClause}`;
    const totalResult = qGet(countSql, [...params]) as { total: number };

    const productsSql = `
      SELECT
        p.id, p.sku, p.name, p.slug, p.short_description,
        p.price, p.sale_price, p.stock_quantity,
        c.slug as category_slug,
        b.name as brand_name,
        (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      ${whereClause}
      ORDER BY p.is_featured DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const products = qAll(productsSql, [...params, limit, offset]);

    const formatted = products.map((p: any) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      slug: p.slug,
      short_description: p.short_description,
      price: p.price,
      sale_price: p.sale_price,
      effective_price: p.sale_price ?? p.price,
      price_formatted: formatPkrCompact(p.sale_price ?? p.price),
      stock_quantity: p.stock_quantity,
      in_stock: p.stock_quantity > 0,
      category_slug: p.category_slug,
      brand_name: p.brand_name,
      primary_image: p.primary_image,
      discount_percent: p.sale_price ? Math.round(((p.price - p.sale_price) / p.price) * 100) : 0,
    }));

    res.json({
      products: formatted,
      pagination: {
        page,
        limit,
        total: totalResult.total,
        total_pages: Math.ceil(totalResult.total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching compatible products:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;