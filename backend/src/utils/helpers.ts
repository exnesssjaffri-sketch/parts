import crypto from 'crypto';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `AM-${timestamp}-${random}`;
}

export function generateIdempotencyKey(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function paisaToPkr(paisa: number): number {
  return Math.round(paisa / 100);
}

export function pkrToPaisa(pkr: number): number {
  return Math.round(pkr * 100);
}

export function formatPkr(paisa: number): string {
  const pkr = paisaToPkr(paisa);
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(pkr);
}

export function formatPkrCompact(paisa: number): string {
  const pkr = paisaToPkr(paisa);
  return `Rs. ${new Intl.NumberFormat('en-PK').format(pkr)}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function sanitizeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function calculateDeliveryCharge(subtotalPaisa: number, freeThreshold: number, charge: number): number {
  if (subtotalPaisa >= freeThreshold) return 0;
  return charge;
}

export function calculateOrderTotals(
  items: Array<{ unit_price: number; quantity: number }>,
  deliveryCharge: number,
  discountAmount: number = 0
): { subtotal: number; delivery: number; discount: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const delivery = deliveryCharge;
  const discount = Math.min(discountAmount, subtotal);
  const total = subtotal + delivery - discount;
  return { subtotal, delivery, discount, total };
}

export function parseJsonSafe<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export function getClientIp(req: any): string {
  return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}