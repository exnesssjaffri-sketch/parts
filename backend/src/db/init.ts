import { ensureDb, getDb, qGet, qRun, schedulePersist, persistSync } from './index.js';
import { getInitSql, SCHEMA_VERSION } from './schema.js';

export async function initDatabase(): Promise<void> {
  await ensureDb();
  const db = getDb();

  // Create schema_version table first
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Check current version
  const current = qGet('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1', []) as { version: number } | undefined;
  const currentVersion = current?.version ?? 0;

  if (currentVersion >= SCHEMA_VERSION) {
    console.log(`Database already at version ${SCHEMA_VERSION}`);
    return;
  }

  console.log(`Initializing database from version ${currentVersion} to ${SCHEMA_VERSION}...`);

  // Run all migrations
  const initSql = getInitSql();
  db.exec(initSql);

  // Record schema version
  qRun('INSERT INTO schema_version (version) VALUES (?)', [SCHEMA_VERSION]);
  persistSync();

  console.log('Database initialized successfully');
}

export async function resetDatabase(): Promise<void> {
  await ensureDb();
  const db = getDb();

  // Drop all tables in reverse dependency order
  const tables = [
    'wishlist_items',
    'product_reviews',
    'coupon_usage',
    'coupons',
    'order_status_history',
    'order_items',
    'orders',
    'cart_items',
    'product_vehicle_compatibility',
    'product_specifications',
    'product_images',
    'products',
    'vehicle_variants',
    'vehicle_models',
    'vehicle_makes',
    'brands',
    'categories',
    'addresses',
    'users',
    'audit_logs',
    'schema_version',
  ];

  for (const table of tables) {
    db.exec(`DROP TABLE IF EXISTS ${table};`);
  }

  console.log('Database reset complete');
  await initDatabase();
  schedulePersist();
}

// CLI entry point — only run if executed directly, not when imported
const isMainModule = process.argv[1] && (process.argv[1].endsWith('init.ts') || process.argv[1].endsWith('init.js'));
if (isMainModule) {
  const cmd = process.argv[2];
  if (cmd === 'reset') {
    resetDatabase().catch(console.error);
  } else if (cmd === '--help' || cmd === '-h') {
    console.log('Usage: tsx backend/src/db/init.ts [init|reset]');
    console.log('  init   Initialize or upgrade the database schema (default)');
    console.log('  reset  Drop all tables and re-initialize');
  } else {
    initDatabase().catch(console.error);
  }
}