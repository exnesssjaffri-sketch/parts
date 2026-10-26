import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ensureDb, qGet, qAll } from '../src/db/index.js';
import { config } from '../src/config/index.js';
import { initDatabase } from '../src/db/init.js';
import * as path from 'path';
import * as fs from 'fs';

const tmpDir = path.join(__dirname, '..', 'test-db');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

function getTestDbPath(name) {
  return path.join(tmpDir, name + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.db');
}

describe('Database Schema Tests', () => {
  let dbPath;
  beforeAll(async () => {
    dbPath = getTestDbPath('schema');
    config.db.path = dbPath;
    await ensureDb();
    await initDatabase();
  });

  afterAll(() => {
    try { fs.unlinkSync(dbPath); } catch {}
    try { fs.unlinkSync(dbPath + '-shm'); } catch {}
    try { fs.unlinkSync(dbPath + '-wal'); } catch {}
  });

  it('schema_version table exists and is at version 2', () => {
    const version = qGet('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1') as { version: number } | undefined;
    expect(version).toBeDefined();
    expect(version?.version).toBe(2);
  });

  it('users table has MFA columns', () => {
    const rows = qAll('PRAGMA table_info(users)') as any[];
    const names = rows.map((c) => c.name);
    expect(names).toContain('mfa_secret');
    expect(names).toContain('mfa_verified');
  });

  it('audit_logs table exists with required columns', () => {
    const rows = qAll('PRAGMA table_info(audit_logs)') as any[];
    const names = rows.map((c) => c.name);
    expect(names).toContain('action');
    expect(names).toContain('entity_type');
    expect(names).toContain('ip_address');
    expect(names).toContain('user_agent');
  });

  it('products table has required columns', () => {
    const rows = qAll('PRAGMA table_info(products)') as any[];
    const names = rows.map((c) => c.name);
    expect(names).toContain('sku');
    expect(names).toContain('price');
    expect(names).toContain('stock_quantity');
    expect(names).toContain('is_active');
  });

  it('orders table has required columns', () => {
    const rows = qAll('PRAGMA table_info(orders)') as any[];
    const names = rows.map((c) => c.name);
    expect(names).toContain('order_number');
    expect(names).toContain('total_amount');
    expect(names).toContain('status');
  });
});

describe('Index Tests', () => {
  let dbPath;
  beforeAll(async () => {
    dbPath = getTestDbPath('indexes');
    config.db.path = dbPath;
    await ensureDb();
    await initDatabase();
  });

  afterAll(() => {
    try { fs.unlinkSync(dbPath); } catch {}
    try { fs.unlinkSync(dbPath + '-shm'); } catch {}
    try { fs.unlinkSync(dbPath + '-wal'); } catch {}
  });

  it('users table has email index', () => {
    const rows = qAll("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='users'") as any[];
    const names = rows.map((r) => r.name);
    expect(names).toContain('idx_users_email');
  });

  it('products table has price index', () => {
    const rows = qAll("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='products'") as any[];
    const names = rows.map((r) => r.name);
    expect(names).toContain('idx_products_price');
  });

  it('orders table has order_number index', () => {
    const rows = qAll("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='orders'") as any[];
    const names = rows.map((r) => r.name);
    expect(names).toContain('idx_orders_order_number');
  });

  it('audit_logs table has entity index', () => {
    const rows = qAll("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='audit_logs'") as any[];
    const names = rows.map((r) => r.name);
    expect(names).toContain('idx_audit_logs_entity');
  });
});
