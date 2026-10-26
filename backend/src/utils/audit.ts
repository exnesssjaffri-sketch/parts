import { qRun } from '../db/index.js';
import type { Request } from 'express';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'register'
  | 'mfa_setup'
  | 'mfa_verify'
  | 'mfa_disable'
  | 'mfa_challenge'
  | 'mfa_challenge_failed'
  | 'profile_update'
  | 'password_change'
  | 'google_login'
  | 'order_create'
  | 'order_status_change'
  | 'product_create'
  | 'product_update'
  | 'product_delete'
  | 'admin_login'
  | 'admin_action'
  | 'rate_limit_exceeded'
  | 'unauthorized_access';

export interface AuditEntry {
  userId?: number;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  oldData?: string;
  newData?: string;
  ipAddress?: string;
  userAgent?: string;
}

export function logAudit(entry: AuditEntry): void {
  try {
    qRun(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId ?? null,
        entry.action,
        entry.entityType,
        entry.entityId ?? null,
        entry.oldData ?? null,
        entry.newData ?? null,
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
      ],
    );
  } catch {
    // Silent fail - audit logging should never break the app
  }
}

export function getAuditLogIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

export function auditMiddleware() {
  return (req: Request, res: any, next: () => void): void => {
    const ip = getAuditLogIp(req);
    const ua = req.headers['user-agent'];

    const path = req.path;
    const method = req.method;

    if (path === '/login' && method === 'POST') {
      const origJson = res.json.bind(res);
      res.json = function (body: any) {
        const userId = body?.user?.id;
        const isFailed = body?.error === 'Unauthorized' || body?.mfa_required === true;
        if (userId || isFailed) {
          logAudit({
            userId: isFailed ? undefined : userId,
            action: isFailed ? 'login_failed' : 'login',
            entityType: 'auth',
            entityId: String(userId ?? 'unknown'),
            ipAddress: ip,
            userAgent: ua,
          });
        }
        return origJson(body);
      };
    }

    if (path === '/register' && method === 'POST') {
      const origJson = res.json.bind(res);
      res.json = function (body: any) {
        if (body?.success && body?.user?.id) {
          logAudit({
            userId: body.user.id,
            action: 'register',
            entityType: 'auth',
            entityId: String(body.user.id),
            ipAddress: ip,
            userAgent: ua,
          });
        }
        return origJson(body);
      };
    }

    if (path === '/logout' && method === 'POST') {
      const origJson = res.json.bind(res);
      res.json = function (body: any) {
        const session = (req as any).session;
        if (session?.userId) {
          logAudit({
            userId: session.userId,
            action: 'logout',
            entityType: 'auth',
            entityId: String(session.userId),
            ipAddress: ip,
            userAgent: ua,
          });
        }
        return origJson(body);
      };
    }

    if ((path === '/mfa/verify' || path === '/mfa/setup') && method === 'POST') {
      const origJson = res.json.bind(res);
      res.json = function (body: any) {
        const session = (req as any).session;
        if (session?.userId && body?.success) {
          logAudit({
            userId: session.userId,
            action: path.includes('verify') ? 'mfa_verify' : 'mfa_setup',
            entityType: 'mfa',
            entityId: String(session.userId),
            ipAddress: ip,
            userAgent: ua,
          });
        }
        return origJson(body);
      };
    }

    if (path === '/mfa/challenge' && method === 'POST') {
      const origJson = res.json.bind(res);
      res.json = function (body: any) {
        const isFailed = body?.error === 'Unauthorized';
        if (isFailed) {
          logAudit({
            action: 'mfa_challenge_failed',
            entityType: 'mfa',
            ipAddress: ip,
            userAgent: ua,
          });
        } else if (body?.success) {
          logAudit({
            action: 'mfa_challenge',
            entityType: 'mfa',
            ipAddress: ip,
            userAgent: ua,
          });
        }
        return origJson(body);
      };
    }

    if (path === '/mfa/disable' && method === 'POST') {
      const origJson = res.json.bind(res);
      res.json = function (body: any) {
        const session = (req as any).session;
        if (session?.userId && body?.success) {
          logAudit({
            userId: session.userId,
            action: 'mfa_disable',
            entityType: 'mfa',
            entityId: String(session.userId),
            ipAddress: ip,
            userAgent: ua,
          });
        }
        return origJson(body);
      };
    }

    if (path === '/google/callback' && method === 'POST') {
      const origJson = res.json.bind(res);
      res.json = function (body: any) {
        if (body?.success && body?.user?.id) {
          logAudit({
            userId: body.user.id,
            action: 'google_login',
            entityType: 'auth',
            entityId: String(body.user.id),
            ipAddress: ip,
            userAgent: ua,
          });
        }
        return origJson(body);
      };
    }

    if (path === '/profile' && method === 'PUT') {
      const origJson = res.json.bind(res);
      res.json = function (body: any) {
        const session = (req as any).session;
        if (session?.userId && body?.success) {
          logAudit({
            userId: session.userId,
            action: 'profile_update',
            entityType: 'user',
            entityId: String(session.userId),
            ipAddress: ip,
            userAgent: ua,
          });
        }
        return origJson(body);
      };
    }

    if (path === '/change-password' && method === 'POST') {
      const origJson = res.json.bind(res);
      res.json = function (body: any) {
        const session = (req as any).session;
        if (session?.userId && body?.success) {
          logAudit({
            userId: session.userId,
            action: 'password_change',
            entityType: 'auth',
            entityId: String(session.userId),
            ipAddress: ip,
            userAgent: ua,
          });
        }
        return origJson(body);
      };
    }

    next();
  };
}
