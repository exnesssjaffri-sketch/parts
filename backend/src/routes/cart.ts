import { config } from '../config/index.js';
import { Router, Request, Response } from 'express';
import { qGet, qAll, qRun, transaction, prepare, getDb } from '../db/index.js';
import { authRequired, optionalAuth, validateBody, validateParams } from '../middleware/index.js';
import { z } from 'zod';
import { formatPkrCompact } from '../utils/helpers.js';

const router = Router();

const addToCartSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive().max(99).default(1),
});

const updateCartSchema = z.object({
  quantity: z.number().int().min(0).max(99),
});

const cartParamsSchema = z.object({
  productId: z.string().regex(/^\d+$/),
});

  // Helper to get session ID - use cookie for anonymous users to ensure consistency
function getSessionId(req: Request, res?: Response): string {
  const sessionId = req.cookies?.cart_session_id;
  if (sessionId) {
    return sessionId;
  }

  const headerSessionId = (req as any).sessionId || req.headers['x-session-id'] as string;
  if (headerSessionId) {
    return headerSessionId;
  }

  const newSessionId = 'anon-' + Math.random().toString(36).substring(2);
  return newSessionId;
}

// GET /api/cart - Get cart items
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const sessionId = session?.userId ? `user-${session.userId}` : getSessionId(req);

    const db = getDb();
    const itemsStmt = db.prepare(`
      SELECT ci.id, ci.product_id, ci.quantity, ci.created_at,
             p.sku, p.name, p.short_description, p.price, p.sale_price,
             p.stock_quantity, p.slug, p.weight_grams,
             c.slug as category_slug, b.name as brand_name,
             (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE ci.session_id = ?
      ORDER BY ci.created_at DESC
    `);
    itemsStmt.bind([sessionId]);
    const items = [];
    while (itemsStmt.step()) {
      items.push(itemsStmt.getAsObject());
    }
    itemsStmt.free();

    const formattedItems = items.map((item: any) => {
      const effectivePrice = item.sale_price ?? item.price;
      const lineTotal = effectivePrice * item.quantity;
      return {
        id: item.id,
        quantity: item.quantity,
        product: {
          id: item.product_id,
          sku: item.sku,
          name: item.name,
          slug: item.slug,
          short_description: item.short_description,
          price: item.price,
          sale_price: item.sale_price,
          effective_price: effectivePrice,
          price_formatted: formatPkrCompact(effectivePrice),
          stock_quantity: item.stock_quantity,
          in_stock: item.stock_quantity > 0,
          max_quantity: Math.min(item.stock_quantity, 99),
          category_slug: item.category_slug,
          brand_name: item.brand_name,
          primary_image: item.primary_image,
          weight_grams: item.weight_grams,
          discount_percent: item.sale_price ? Math.round(((item.price - item.sale_price) / item.price) * 100) : 0,
        },
        line_total: lineTotal,
        line_total_formatted: formatPkrCompact(lineTotal),
      };
    });

    const subtotal = formattedItems.reduce((sum: number, item: { line_total: number; quantity: number }) => sum + item.line_total, 0);
    const itemCount = formattedItems.reduce((sum: number, item: { line_total: number; quantity: number }) => sum + item.quantity, 0);

    res.json({
      items: formattedItems,
      summary: {
        item_count: itemCount,
        subtotal,
        subtotal_formatted: formatPkrCompact(subtotal),
      },
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/cart - Add item to cart
router.post('/', optionalAuth, validateBody(addToCartSchema), async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const sessionId = session?.userId ? `user-${session.userId}` : getSessionId(req, res);
    const { product_id, quantity } = req.body;

    // Check product exists and is active
    const product = qGet('SELECT id, stock_quantity FROM products WHERE id = ? AND is_active = 1', [product_id]);
    if (!product) {
      return res.status(404).json({ error: 'Not Found', message: 'Product not found' });
    }

    if ((product as any).stock_quantity < quantity) {
      return res.status(400).json({
        error: 'Out of Stock',
        message: `Only ${(product as any).stock_quantity} items available`,
        available: (product as any).stock_quantity,
      });
    }

    // Upsert cart item
    const existing = qGet('SELECT id, quantity FROM cart_items WHERE session_id = ? AND product_id = ?', [sessionId, product_id]);

    if (existing) {
      const newQuantity = Math.min((existing as any).quantity + quantity, (product as any).stock_quantity, 99);
      qRun('UPDATE cart_items SET quantity = ?, updated_at = datetime("now") WHERE id = ?', [newQuantity, (existing as any).id]);
    } else {
      qRun('INSERT INTO cart_items (session_id, product_id, quantity) VALUES (?, ?, ?)', [sessionId, product_id, quantity]);
    }

    // Set cookie for session consistency
    const cookieOptions = {
      httpOnly: true,
      secure: false, // Set to false for development
      sameSite: 'lax' as const,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    };
    res.cookie('cart_session_id', sessionId, cookieOptions);

    // Return updated cart
    const items = qAll(`
      SELECT ci.quantity, p.price, p.sale_price
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.session_id = ?
    `, [sessionId]) as { quantity: number; price: number; sale_price: number | null }[];

    const subtotal = items.reduce((sum: number, item: { quantity: number; price: number; sale_price: number | null }) => sum + (item.sale_price ?? item.price) * item.quantity, 0);
    const itemCount = items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);

    res.json({
      success: true,
      message: 'Added to cart',
      summary: {
        item_count: itemCount,
        subtotal,
        subtotal_formatted: formatPkrCompact(subtotal),
      },
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/cart/:productId - Update cart item quantity
router.put('/:productId', optionalAuth, validateParams(cartParamsSchema), validateBody(updateCartSchema), async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const sessionId = session?.userId ? `user-${session.userId}` : getSessionId(req, res);
    const productId = parseInt(Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId);
    const { quantity } = req.body;

    if (quantity === 0) {
      qRun('DELETE FROM cart_items WHERE session_id = ? AND product_id = ?', [sessionId, productId]);
      return res.json({ success: true, message: 'Item removed from cart' });
    }

    // Check stock
    const product = qGet('SELECT stock_quantity FROM products WHERE id = ? AND is_active = 1', [productId]) as { stock_quantity: number } | undefined;
    if (!product) {
      return res.status(404).json({ error: 'Not Found', message: 'Product not found' });
    }

    const newQuantity = Math.min(quantity, product.stock_quantity, 99);
    qRun('UPDATE cart_items SET quantity = ?, updated_at = datetime("now") WHERE session_id = ? AND product_id = ?', [newQuantity, sessionId, productId]);

    // Return updated cart
    const items = qAll(`
      SELECT ci.quantity, p.price, p.sale_price
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.session_id = ?
    `, [sessionId]) as { quantity: number; price: number; sale_price: number | null }[];

    const subtotal = items.reduce((sum: number, item: { quantity: number; price: number; sale_price: number | null }) => sum + (item.sale_price ?? item.price) * item.quantity, 0);
    const itemCount = items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);

    res.json({
      success: true,
      message: 'Cart updated',
      summary: {
        item_count: itemCount,
        subtotal,
        subtotal_formatted: formatPkrCompact(subtotal),
      },
    });
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/cart/:productId - Remove item from cart
router.delete('/:productId', optionalAuth, validateParams(cartParamsSchema), async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const sessionId = session?.userId ? `user-${session.userId}` : getSessionId(req, res);
    const productId = parseInt(Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId);

    qRun('DELETE FROM cart_items WHERE session_id = ? AND product_id = ?', [sessionId, productId]);

    // Return updated cart
    const items = qAll(`
      SELECT ci.quantity, p.price, p.sale_price
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.session_id = ?
    `, [sessionId]) as { quantity: number; price: number; sale_price: number | null }[];

    const subtotal = items.reduce((sum: number, item: { quantity: number; price: number; sale_price: number | null }) => sum + (item.sale_price ?? item.price) * item.quantity, 0);
    const itemCount = items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);

    res.json({
      success: true,
      message: 'Item removed from cart',
      summary: {
        item_count: itemCount,
        subtotal,
        subtotal_formatted: formatPkrCompact(subtotal),
      },
    });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/cart - Clear cart
router.delete('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const sessionId = session?.userId ? `user-${session.userId}` : getSessionId(req, res);

    qRun('DELETE FROM cart_items WHERE session_id = ?', [sessionId]);

    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/cart/count - Get cart item count (for header badge)
router.get('/count', optionalAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const sessionId = session?.userId ? `user-${session.userId}` : getSessionId(req);

    const result = qGet('SELECT COALESCE(SUM(quantity), 0) as count FROM cart_items WHERE session_id = ?', [sessionId]) as { count: number };

    res.json({ count: result.count });
  } catch (error) {
    console.error('Error fetching cart count:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/cart/merge - Merge anonymous cart with user cart on login
router.post('/merge', authRequired, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const userId = session.userId;
    const anonSessionId = req.body.session_id; // anonymous session ID

    if (!anonSessionId || anonSessionId.startsWith('user-')) {
      return res.json({ success: true, message: 'No anonymous cart to merge' });
    }

    // Get anonymous cart items
    const anonItems = qAll('SELECT product_id, quantity FROM cart_items WHERE session_id = ?', [anonSessionId]) as { product_id: number; quantity: number }[];

    for (const item of anonItems) {
      const existing = qGet('SELECT id, quantity FROM cart_items WHERE session_id = ? AND product_id = ?', [`user-${userId}`, item.product_id]) as { id: number; quantity: number } | undefined;

      // Check stock
      const product = qGet('SELECT stock_quantity FROM products WHERE id = ? AND is_active = 1', [item.product_id]) as { stock_quantity: number } | undefined;
      if (!product) continue;

      const maxQty = Math.min(99, product.stock_quantity);
      const newQty = existing ? Math.min(existing.quantity + item.quantity, maxQty) : Math.min(item.quantity, maxQty);

      if (existing) {
        qRun('UPDATE cart_items SET quantity = ?, updated_at = datetime("now") WHERE id = ?', [newQty, existing.id]);
      } else {
        qRun('INSERT INTO cart_items (session_id, product_id, quantity) VALUES (?, ?, ?)', [`user-${userId}`, item.product_id, newQty]);
      }
    }

    // Delete anonymous cart
    qRun('DELETE FROM cart_items WHERE session_id = ?', [anonSessionId]);

    res.json({ success: true, message: 'Cart merged successfully' });
  } catch (error) {
    console.error('Error merging cart:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;