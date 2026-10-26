import { Router, Request, Response } from 'express';
import { qGet, qAll, qRun, transaction, prepare } from '../db/index.js';
import { authRequired, validateBody, optionalAuth, validateQuery } from '../middleware/index.js';
import { z } from 'zod';
import { generateOrderNumber, generateIdempotencyKey, calculateDeliveryCharge, calculateOrderTotals, formatPkrCompact, formatDateTime } from '../utils/helpers.js';
import { config } from '../config/index.js';

const router = Router();

const checkoutSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(10).max(20),
  shipping_address: z.object({
    recipient_name: z.string().min(2),
    phone: z.string().min(10).max(20),
    address_line1: z.string().min(5),
    address_line2: z.string().optional(),
    city: z.string().min(2),
    state: z.string().min(2),
    postal_code: z.string().min(4),
    country: z.string().default('Pakistan'),
  }),
  billing_address: z.object({
    recipient_name: z.string().min(2),
    phone: z.string().min(10).max(20),
    address_line1: z.string().min(5),
    address_line2: z.string().optional(),
    city: z.string().min(2),
    state: z.string().min(2),
    postal_code: z.string().min(4),
    country: z.string().default('Pakistan'),
  }).optional(),
  payment_method: z.enum(['cod']).default('cod'),
  coupon_code: z.string().optional(),
  notes: z.string().optional(),
  idempotency_key: z.string().optional(),
});

const orderQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  status: z.string().optional(),
});

// POST /api/orders/checkout - Create order from cart
router.post('/checkout', optionalAuth, validateBody(checkoutSchema), async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const userId = session?.userId;

    // Create session ID consistently - use the same logic as cart routes
    function getSessionId(req: Request, res?: Response): string {
      // Check if we have a session ID in cookies
      const sessionId = req.cookies?.cart_session_id;
      if (sessionId) {
        return sessionId;
      }

      // Check headers (for legacy compatibility)
      const headerSessionId = (req as any).sessionId || req.headers['x-session-id'] as string;
      if (headerSessionId) {
        return headerSessionId;
      }

      // Generate new session ID
      const newSessionId = 'anon-' + Math.random().toString(36).substring(2);
      return newSessionId;
    }

    const sessionId = userId ? `user-${userId}` : getSessionId(req, res);

    const {
      email, phone, shipping_address, billing_address, payment_method,
      coupon_code, notes, idempotency_key
    } = req.body;



    // Get cart items (before transaction - using global db)
    const cartItems = qAll(`
      SELECT ci.product_id, ci.quantity, p.price, p.sale_price, p.stock_quantity, p.name, p.sku
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.session_id = ? AND p.is_active = 1
    `, [sessionId]);


    if (cartItems.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Cart is empty' });
    }

    // Validate stock
    for (const item of cartItems as { stock_quantity: number; quantity: number; name: string; product_id: number }[]) {
      if (item.stock_quantity < item.quantity) {
        return res.status(400).json({
          error: 'Out of Stock',
          message: `${item.name} has only ${item.stock_quantity} in stock`,
          product_id: item.product_id,
          available: item.stock_quantity,
        });
      }
    }

    // Check idempotency
    const idempotencyKey = idempotency_key || generateIdempotencyKey();
    const existingOrder = qGet('SELECT id FROM orders WHERE idempotency_key = ?', [idempotencyKey]);
    if (existingOrder) {
      return res.status(409).json({ error: 'Conflict', message: 'Order already processed', order_id: (existingOrder as any).id });
    }

    // Validate coupon
    let discountAmount = 0;
    let couponId: number | null = null;

    if (coupon_code) {
      const coupon = qGet('SELECT * FROM coupons WHERE code = ? AND is_active = 1', [coupon_code]);
      if (coupon) {
        const c = coupon as any;
        const now = new Date().toISOString();

        if (c.starts_at && new Date(c.starts_at) > new Date(now)) {
          return res.status(400).json({ error: 'Invalid Coupon', message: 'Coupon not yet valid' });
        }
        if (c.expires_at && new Date(c.expires_at) < new Date(now)) {
          return res.status(400).json({ error: 'Invalid Coupon', message: 'Coupon expired' });
        }
        if (c.usage_limit && c.usage_count >= c.usage_limit) {
          return res.status(400).json({ error: 'Invalid Coupon', message: 'Coupon usage limit reached' });
        }

        // Check user usage
        if (userId) {
          const userUsage = qGet('SELECT COUNT(*) as c FROM coupon_usage WHERE coupon_id = ? AND user_id = ?', [c.id, userId]) as { c: number };
          if (userUsage.c >= c.user_limit) {
            return res.status(400).json({ error: 'Invalid Coupon', message: 'Coupon already used by this user' });
          }
        }

        // Calculate discount
        const subtotal = cartItems.reduce((sum: number, item: any) => sum + (item.sale_price ?? item.price) * item.quantity, 0);

        if (subtotal < c.min_order_amount) {
          return res.status(400).json({ error: 'Invalid Coupon', message: `Minimum order Rs. ${c.min_order_amount / 100} required` });
        }

        // Verify coupon ownership
        if (c.user_id && c.user_id !== userId) {
          return res.status(400).json({ error: 'Invalid Coupon', message: 'This coupon is for another user' });
        }

        // Verify coupon ownership
        if (c.user_id && c.user_id !== userId) {
          return res.status(400).json({ error: 'Invalid Coupon', message: 'This coupon is for another user' });
        }

        if (c.discount_type === 'percentage') {
          discountAmount = Math.round(subtotal * c.discount_value / 100);
          if (c.max_discount_amount) {
            discountAmount = Math.min(discountAmount, c.max_discount_amount);
          }
        } else {
          discountAmount = Math.min(c.discount_value, subtotal);
        }

        couponId = c.id;
      } else {
        return res.status(400).json({ error: 'Invalid Coupon', message: 'Coupon not found or inactive' });
      }
    }

    // Calculate totals
    const itemsForCalc = (cartItems as { price: number; sale_price: number | null; quantity: number }[]).map(item => ({
      unit_price: item.sale_price ?? item.price,
      quantity: item.quantity,
    }));

    const deliveryCharge = calculateDeliveryCharge(
      itemsForCalc.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
      config.delivery.freeThresholdPkR,
      config.delivery.chargePkR
    );

    const { subtotal, delivery, discount, total } = calculateOrderTotals(itemsForCalc, deliveryCharge, discountAmount);

    // Create order in transaction
    const orderNumber = generateOrderNumber();
    const shippingAddressJson = JSON.stringify(shipping_address);
    const billingAddressJson = JSON.stringify(billing_address || shipping_address);

    const orderResult = transaction((db) => {
      try {

const orderInsert = prepare(`
        INSERT INTO orders (
          order_number, user_id, session_id, email, phone, status, payment_method,
          payment_status, subtotal, delivery_charge, discount_amount, total_amount,
          currency, shipping_address, billing_address, notes, idempotency_key
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?, 'pending', ?, ?, ?, ?, 'PKR', ?, ?, ?, ?)
      `, db);



      const result = orderInsert.run(
        orderNumber, userId || null, sessionId, email, phone, payment_method,
        subtotal, delivery, discount, total,
        shippingAddressJson, billingAddressJson, notes || null, idempotencyKey
      );


      const orderId = result.lastInsertRowid as number;

      // Insert order items
      const itemInsert = prepare(`
        INSERT INTO order_items (order_id, product_id, product_sku, product_name, unit_price, quantity, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, db);

      for (const item of cartItems as { product_id: number; sku: string; name: string; price: number; sale_price: number | null; quantity: number }[]) {
        const unitPrice = item.sale_price ?? item.price;
        const lineTotal = unitPrice * item.quantity;
        itemInsert.run(orderId, item.product_id, item.sku, item.name, unitPrice, item.quantity, lineTotal);

        // Decrease stock
        qRun('UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = datetime("now") WHERE id = ?', [item.quantity, item.product_id]);
      }

      // Record status history
      qRun('INSERT INTO order_status_history (order_id, status, notes) VALUES (?, ?, ?)', [orderId, 'pending', 'Order placed']);

      // Record coupon usage
      if (couponId) {
        qRun('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?', [couponId]);
        if (userId) {
          qRun('INSERT INTO coupon_usage (coupon_id, user_id, order_id) VALUES (?, ?, ?)', [couponId, userId, orderId]);
        }
      }

      // Clear cart
      qRun('DELETE FROM cart_items WHERE session_id = ?', [sessionId]);

      return { orderId, orderNumber };
      } catch (txError) {

throw txError;
      }
    });



    // Fetch full order for response (outside transaction, using global db)
    const order = qGet(`
      SELECT * FROM orders WHERE id = ?
    `, [orderResult.orderId]) as {
      id: number;
      order_number: string;
      status: string;
      payment_status: string;
      payment_method: string;
      subtotal: number;
      delivery_charge: number;
      discount_amount: number;
      total_amount: number;
      currency: string;
      shipping_address: string;
      billing_address: string | null;
      notes: string | null;
      created_at: string;
    } | undefined;


    const orderItems = qAll(`
      SELECT * FROM order_items WHERE order_id = ?
    `, [orderResult.orderId]) as { id: number; product_id: number; product_sku: string; product_name: string; unit_price: number; quantity: number; line_total: number }[];

    if (!order) {
      return res.status(500).json({ error: 'Internal Server Error', message: 'Order not found after creation' });
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        subtotal: order.subtotal,
        delivery_charge: order.delivery_charge,
        discount_amount: order.discount_amount,
        total_amount: order.total_amount,
        subtotal_formatted: formatPkrCompact(order.subtotal),
        delivery_charge_formatted: formatPkrCompact(order.delivery_charge),
        discount_formatted: formatPkrCompact(order.discount_amount),
        total_formatted: formatPkrCompact(order.total_amount),
        shipping_address: JSON.parse(order.shipping_address),
        billing_address: JSON.parse(order.billing_address || '{}'),
        notes: order.notes,
        items: (orderItems as { id: number; product_id: number; product_sku: string; product_name: string; unit_price: number; quantity: number; line_total: number }[]).map(item => ({
          id: item.id,
          product_id: item.product_id,
          product_sku: item.product_sku,
          product_name: item.product_name,
          unit_price: item.unit_price,
          unit_price_formatted: formatPkrCompact(item.unit_price),
          quantity: item.quantity,
          line_total: item.line_total,
          line_total_formatted: formatPkrCompact(item.line_total),
        })),
        created_at: order.created_at,
        created_at_formatted: formatDateTime(order.created_at),
      },
    });
  } catch (error) {
    console.error('Error creating order:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Error cause:', error.cause);
      console.error('Error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } else {
      console.error('Error (non-Error):', error);
    }
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create order', details: (error as any).message || String(error) });
  }
});

// GET /api/orders - Get user's orders
router.get('/', authRequired, validateQuery(orderQuerySchema), async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const query = req.query as any;
    const page = Math.max(parseInt(query.page as string) || 1, 1);
    const limit = Math.min(parseInt(query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const status = query.status as string | undefined;

    let whereClause = 'WHERE user_id = ?';
    const params: any[] = [session.userId];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const countSql = `SELECT COUNT(*) as total FROM orders ${whereClause}`;
    const totalResult = qGet(countSql, [...params]) as { total: number };

    const ordersSql = `
      SELECT * FROM orders ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const orders = qAll(ordersSql, [...params, limit, offset]);

    const formattedOrders = orders.map((order: any) => ({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      subtotal: order.subtotal,
      delivery_charge: order.delivery_charge,
      discount_amount: order.discount_amount,
      total_amount: order.total_amount,
      subtotal_formatted: formatPkrCompact(order.subtotal),
      delivery_charge_formatted: formatPkrCompact(order.delivery_charge),
      discount_formatted: formatPkrCompact(order.discount_amount),
      total_formatted: formatPkrCompact(order.total_amount),
      created_at: order.created_at,
      created_at_formatted: formatDateTime(order.created_at),
      confirmed_at: order.confirmed_at,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at,
      item_count: 0, // will be populated below
    }));

    // Get item counts for each order
    for (const order of formattedOrders) {
      const count = qGet('SELECT COUNT(*) as c, COALESCE(SUM(quantity), 0) as qty FROM order_items WHERE order_id = ?', [order.id]) as { c: number; qty: number };
      order.item_count = count.qty;
    }

    res.json({
      orders: formattedOrders,
      pagination: {
        page,
        limit,
        total: totalResult.total,
        total_pages: Math.ceil(totalResult.total / limit),
        has_next: page < Math.ceil(totalResult.total / limit),
        has_prev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/orders/:orderNumber - Get order details
router.get('/:orderNumber', authRequired, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const { orderNumber } = req.params;

    const order = qGet('SELECT * FROM orders WHERE order_number = ? AND user_id = ?', [orderNumber, session.userId]) as {
      id: number;
      order_number: string;
      status: string;
      payment_status: string;
      payment_method: string;
      payment_reference: string | null;
      subtotal: number;
      delivery_charge: number;
      discount_amount: number;
      total_amount: number;
      currency: string;
      shipping_address: string;
      billing_address: string | null;
      notes: string | null;
      created_at: string;
      confirmed_at: string | null;
      shipped_at: string | null;
      delivered_at: string | null;
    } | undefined;

    if (!order) {
      return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
    }

    const items = qAll(`
      SELECT oi.*, p.slug as product_slug, p.sku
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [order.id]) as { id: number; product_id: number; product_sku: string; product_slug: string | null; product_name: string; unit_price: number; quantity: number; line_total: number }[];

    const statusHistory = qAll(`
      SELECT status, notes, created_at, u.first_name, u.last_name
      FROM order_status_history osh
      LEFT JOIN users u ON osh.changed_by = u.id
      WHERE osh.order_id = ?
      ORDER BY osh.created_at ASC
    `, [order.id]);

    res.json({
      order: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        payment_reference: order.payment_reference,
        subtotal: order.subtotal,
        delivery_charge: order.delivery_charge,
        discount_amount: order.discount_amount,
        total_amount: order.total_amount,
        subtotal_formatted: formatPkrCompact(order.subtotal),
        delivery_charge_formatted: formatPkrCompact(order.delivery_charge),
        discount_formatted: formatPkrCompact(order.discount_amount),
        total_formatted: formatPkrCompact(order.total_amount),
        currency: order.currency,
        shipping_address: JSON.parse(order.shipping_address),
        billing_address: JSON.parse(order.billing_address || '{}'),
        notes: order.notes,
        items: (items as { id: number; product_id: number; product_sku: string; product_slug: string | null; product_name: string; unit_price: number; quantity: number; line_total: number }[]).map(item => ({
          id: item.id,
          product_id: item.product_id,
          product_sku: item.product_sku,
          product_slug: item.product_slug,
          product_name: item.product_name,
          unit_price: item.unit_price,
          unit_price_formatted: formatPkrCompact(item.unit_price),
          quantity: item.quantity,
          line_total: item.line_total,
          line_total_formatted: formatPkrCompact(item.line_total),
        })),
        status_history: statusHistory.map((h: any) => ({
          status: h.status,
          notes: h.notes,
          changed_by: h.first_name ? `${h.first_name} ${h.last_name}` : 'System',
          created_at: h.created_at,
          created_at_formatted: formatDateTime(h.created_at),
        })),
        created_at: order.created_at,
        created_at_formatted: formatDateTime(order.created_at),
        confirmed_at: order.confirmed_at,
        shipped_at: order.shipped_at,
        delivered_at: order.delivered_at,
      },
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/orders/track/:orderNumber - Public order tracking (no auth required)
router.get('/track/:orderNumber', async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { email, phone } = req.query as { email?: string; phone?: string };

    const order = qGet('SELECT * FROM orders WHERE order_number = ?', [orderNumber]) as any;
    if (!order) {
      return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
    }

    // Verify email or phone for public tracking
    if (email && order.email !== email) {
      return res.status(403).json({ error: 'Forbidden', message: 'Invalid email for this order' });
    }
    if (phone && order.phone !== phone) {
      return res.status(403).json({ error: 'Forbidden', message: 'Invalid phone for this order' });
    }

    const statusHistory = qAll(`
      SELECT status, notes, created_at
      FROM order_status_history
      WHERE order_id = ?
      ORDER BY created_at ASC
    `, [order.id]);

    const statusOrder = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
    const currentStatusIndex = statusOrder.indexOf(order.status);

    res.json({
      order: {
        order_number: order.order_number,
        status: order.status,
        status_label: order.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        total_amount: order.total_amount,
        total_formatted: formatPkrCompact(order.total_amount),
        shipping_address: JSON.parse(order.shipping_address),
        status_history: statusHistory.map((h: any) => ({
          status: h.status,
          status_label: h.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          notes: h.notes,
          created_at: h.created_at,
          created_at_formatted: formatDateTime(h.created_at),
        })),
        timeline: statusOrder.map((s, i) => ({
          status: s,
          status_label: s.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          completed: i <= currentStatusIndex,
          current: i === currentStatusIndex,
        })),
        created_at: order.created_at,
        created_at_formatted: formatDateTime(order.created_at),
        confirmed_at: order.confirmed_at,
        shipped_at: order.shipped_at,
        delivered_at: order.delivered_at,
      },
    });
  } catch (error) {
    console.error('Error tracking order:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/orders/:orderNumber/cancel - Cancel order (if allowed)
router.post('/:orderNumber/cancel', authRequired, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const { orderNumber } = req.params;
    const { reason } = req.body;

    const order = qGet('SELECT * FROM orders WHERE order_number = ? AND user_id = ?', [orderNumber, session.userId]) as { id: number; status: string; notes: string | null } | undefined;
    if (!order) {
      return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
    }

    const cancellableStatuses = ['pending', 'confirmed'];
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({ error: 'Bad Request', message: `Cannot cancel order in ${order.status} status` });
    }

    transaction(() => {
      qRun('UPDATE orders SET status = ?, cancelled_at = datetime("now"), notes = COALESCE(notes, "") || ? WHERE id = ?', ['cancelled', `\nCancelled: ${reason || 'Customer requested'}`, order.id]);
      qRun('INSERT INTO order_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)', [order.id, 'cancelled', reason || 'Customer requested cancellation', session.userId]);

      // Restore stock
      const items = qAll('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [order.id]) as { product_id: number; quantity: number }[];
      for (const item of items) {
        qRun('UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = datetime("now") WHERE id = ?', [item.quantity, item.product_id]);
      }
    });

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;