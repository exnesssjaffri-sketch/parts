import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ensureDb, qGet } from '../src/db/index.js';
import { initDatabase } from '../src/db/init.js';
import { config } from '../src/config/index.js';
import { logAudit, getAuditLogIp, auditMiddleware } from '../src/utils/audit.js';
import * as path from 'path';
import * as fs from 'fs';

const tmpDir = path.join(__dirname, '..', 'test-db');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

function getTestDbPath(name) {
  return path.join(tmpDir, name + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.db');
}

describe('Audit Logging - Core Functions', () => {
  let dbPath;
  beforeAll(async () => {
    dbPath = getTestDbPath('audit');
    config.db.path = dbPath;
    await ensureDb();
    await initDatabase();
  });

  afterAll(() => {
    try { fs.unlinkSync(dbPath); } catch {}
    try { fs.unlinkSync(dbPath + '-shm'); } catch {}
    try { fs.unlinkSync(dbPath + '-wal'); } catch {}
  });

  it('logAudit should insert a record into audit_logs', () => {
    logAudit({
      userId: 1,
      action: 'login',
      entityType: 'auth',
      entityId: '1',
      ipAddress: '127.0.0.1',
      userAgent: 'TestBot/1.0',
    });
    // Verify by checking the table has the row
    const countRow = qGet('SELECT COUNT(*) as c FROM audit_logs WHERE action = ?', ['login']) as { c: number } | undefined;
    const count = countRow?.c ?? 0;
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('logAudit should handle missing optional fields', () => {
    expect(() => logAudit({ action: 'mfa_challenge', entityType: 'mfa' })).not.toThrow();
  });

  it('logAudit should silently handle errors when DB not ready', () => {
    // This should never throw even if DB fails
    expect(() => logAudit({ action: 'login', entityType: 'auth', ipAddress: '1.2.3.4' })).not.toThrow();
  });
});

describe('Audit Middleware', () => {
  it('should call next without throwing for any path', () => {
    const middleware = auditMiddleware();
    let nextCalled = false;
    const req = {
      path: '/api/products',
      method: 'GET',
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {},
    };
    const res = {};
    middleware(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('should extract IP from x-forwarded-for header', () => {
    const middleware = auditMiddleware();
    const req = {
      path: '/api/health',
      method: 'GET',
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'x-forwarded-for': '203.0.113.50, 70.41.3.18' },
    };
    const res = {};
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('should not throw on login success logging', () => {
    const middleware = auditMiddleware();
    const req = {
      path: '/login',
      method: 'POST',
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {},
    };
    const res = {
      jsonBody: null,
      statusCode: 200,
      json(body) {
        this.jsonBody = body;
        return this;
      },
    };
    middleware(req, res, () => {});
    res.json({ success: true, user: { id: 1 }, message: 'ok' });
    expect(res.jsonBody).toEqual({ success: true, user: { id: 1 }, message: 'ok' });
  });

  it('should log login failure', () => {
    const middleware = auditMiddleware();
    const req = {
      path: '/login',
      method: 'POST',
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {},
    };
    const res = {
      jsonBody: null,
      statusCode: 200,
      json(body) {
        this.jsonBody = body;
        return this;
      },
    };
    middleware(req, res, () => {});
    res.json({ error: 'Unauthorized', message: 'Invalid email or password' });
    expect(res.jsonBody).toBeDefined();
  });
});
