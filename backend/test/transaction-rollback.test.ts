import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ensureDb, qGet, transaction, prepare } from '../src/db/index.js';
import { config } from '../src/config/index.js';
import { initDatabase } from '../src/db/init.js';
import * as path from 'path';
import * as fs from 'fs';

const tmpDir = path.join(__dirname, '..', 'test-db');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

function getTestDbPath(name) {
  return path.join(tmpDir, name + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.db');
}

describe('Transaction Rollback - Atomicity Verification', () => {
  let dbPath;
  beforeAll(async () => {
    dbPath = getTestDbPath('tx_rollback');
    config.db.path = dbPath;
    await ensureDb();
    await initDatabase();
  });

  afterAll(() => {
    try { fs.unlinkSync(dbPath); } catch {}
    try { fs.unlinkSync(dbPath + '-shm'); } catch {}
    try { fs.unlinkSync(dbPath + '-wal'); } catch {}
  });

  it('transaction commits all changes on success', () => {
    transaction((db) => {
      prepare('INSERT INTO products (name, sku, slug, price, stock_quantity, description, category_id, brand_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', db).run([
        'Tx Test Product', 'TX-TEST-001', 'tx-test-001', 500000, 10, 'Transactional test item', 1, 1
      ]);
    });

    const count = (qGet("SELECT COUNT(*) as c FROM products WHERE sku = ?", ['TX-TEST-001']) as { c: number })?.c || 0;
    expect(count).toBe(1);
  });

  it('transaction rolls back all changes on failure', () => {
    try {
      transaction((db) => {
        prepare('INSERT INTO products (name, sku, slug, price, stock_quantity, description, category_id, brand_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', db).run([
          'Rollback Test', 'TX-ROLLBACK-001', 'tx-rollback-001', 100000, 5, 'Should be rolled back', 1, 1
        ]);
        prepare('INSERT INTO products (invalid_column) VALUES (?)', db).run(['should fail']);
      });
    } catch (e) {
      // Expected to throw
    }

    const finalCount = (qGet("SELECT COUNT(*) as c FROM products WHERE sku = 'TX-ROLLBACK-001'", []) as { c: number } | undefined)?.c || 0;
    expect(finalCount).toBe(0);
  });

  it('transaction rollback leaves no partial state', () => {
    try {
      transaction((db) => {
        prepare('INSERT INTO products (name, sku, slug, price, stock_quantity, description, category_id, brand_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', db).run([
          'Partial Rollback', 'TX-PARTIAL-001', 'tx-partial-001', 200000, 8, 'First insert should roll back', 1, 1
        ]);
        prepare('UPDATE nonexistent_table SET col = ?', db).run(['fail']);
      });
    } catch (e) {
      // Expected
    }

    const productCount = (qGet("SELECT COUNT(*) as c FROM products WHERE sku = 'TX-PARTIAL-001'", []) as { c: number } | undefined)?.c || 0;
    expect(productCount).toBe(0);
  });
});
