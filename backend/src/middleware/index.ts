import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { getSession, SessionData } from '../auth/index.js';

const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = config.rateLimit.windowMs;
  const maxRequests = config.rateLimit.maxRequests;

  const record = requestCounts.get(ip);
  if (!record || record.resetAt < now) {
    requestCounts.set(ip, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }

  if (record.count >= maxRequests) {
    res.set('Retry-After', Math.ceil((record.resetAt - now) / 1000).toString());
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    });
    return;
  }

  record.count++;
  next();
}

export function authRequired(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    return;
  }

  const session = getSession(token);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired session' });
    return;
  }

  (req as any).session = session;
  (req as any).user = session;
  next();
}

export function adminRequired(req: Request, res: Response, next: NextFunction): void {
  const session = (req as any).session as SessionData | undefined;
  if (!session || !session.isAdmin) {
    res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    return;
  }
  next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const session = getSession(token);
    if (session) {
      (req as any).session = session;
      (req as any).user = session;
    }
  }
  next();
}

export function validateBody(schema: any) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: result.error.flatten().fieldErrors,
      });
      return;
    }
    next();
  };
}

export function validateQuery(schema: any) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid query parameters',
        details: result.error.flatten().fieldErrors,
      });
      return;
    }
    (req as any).validatedQuery = result.data;
    next();
  };
}

export function validateParams(schema: any) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid route parameters',
        details: result.error.flatten().fieldErrors,
      });
      return;
    }
    next();
  };
}

export function corsHeaders(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (origin && config.cors.allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (config.env === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  console.error('Error:', err);
  if (config.env === 'development') {
    console.error(err.stack);
  }

  if (err.name === 'ValidationError') {
    res.status(400).json({ error: 'Validation Error', message: err.message });
    return;
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: config.env === 'development' ? err.message : 'An unexpected error occurred',
  });
}