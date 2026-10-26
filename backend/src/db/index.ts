import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync } from 'fs';
import { config } from '../config/index.js';

// sql.js is a pure-JS SQLite build (no native compilation required)
import initSqlJs from 'sql.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type SqlJsDatabase = any;

let db: SqlJsDatabase | null = null;
let dbPath: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let initPromise: Promise<SqlJsDatabase> | null = null;

function getSqlJs() {
  const wasmPath = join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  return initSqlJs({
    locateFile: () => wasmPath,
  });
}

function resolveDbPath(): string {
  const p = config.db.path;
  let resolved: string;
  if (p.startsWith('.') || p.startsWith('./') || p.startsWith('.\\')) {
    resolved = join(process.cwd(), p);
  } else {
    resolved = p;
  }
  console.error('[db] Resolved DB path:', resolved);
  return resolved;
}

function ensureDir(filePath: string): void {
  const dir = join(filePath, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// Sync persist without timer — for CLI scripts
export function persistSync(): void {
  if (!db || !dbPath) {
    console.error('[db] persistSync: db or dbPath missing', { db: !!db, dbPath });
    return;
  }
  try {
    // Force DELETE mode to avoid WAL issues
    db.exec('PRAGMA journal_mode = DELETE');
    const data = db.export();
    ensureDir(dbPath);
    console.error('[db] persistSync: exporting', data.length, 'bytes');
    writeFileSync(dbPath, Buffer.from(data));
    console.error('[db] persistSync: wrote to', dbPath);
    const stat = statSync(dbPath);
    console.error('[db] persistSync: file size', stat.size);
  } catch (e) {
    console.error('[db] persistSync failed:', e);
  }
}

function persist(): void {
  if (!db || !dbPath) {
    console.error('[db] Cannot persist: db or dbPath missing', { db: !!db, dbPath });
    return;
  }
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    const data = db.export();
    ensureDir(dbPath);
    writeFileSync(dbPath, Buffer.from(data));
  } catch (e) {
    console.error('Failed to persist database:', e);
  }
}

export function schedulePersist(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persist();
  }, 200);
}

// Async initialization — must be awaited at startup before any DB access.
export async function ensureDb(): Promise<SqlJsDatabase> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await getSqlJs();
    dbPath = resolveDbPath();

    if (existsSync(dbPath)) {
      console.error('[db] ensureDb: loading existing DB file');
      const buf = readFileSync(dbPath);
      db = new SQL.Database(new Uint8Array(buf));
    } else {
      console.error('[db] ensureDb: creating new DB');
      db = new SQL.Database();
      ensureDir(dbPath);
    }

    try { db.run('PRAGMA foreign_keys = ON'); } catch (_) { /* no-op */ }
    // Always use DELETE journal mode for reliable export-based persistence
    try { db.run('PRAGMA journal_mode = DELETE'); } catch (_) { /* no-op */ }
    try { db.run('PRAGMA busy_timeout = 5000'); } catch (_) { /* no-op */ }

    return db;
  })();

  return initPromise;
}

// Synchronous accessor — the app guarantees ensureDb() was awaited at startup.
export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call await ensureDb() at startup.');
  }
  return db;
}

// Query helpers that work correctly with sql.js.
// Always resolve through getDb() so a not-yet-initialized db yields a clear
// error instead of a cryptic "Cannot read properties of null".
export function qGet(sql: string, params: any[] = []): any {
  const database = getDb();
  const stmt = database.prepare(sql);
  stmt.bind(Array.isArray(params) ? params : [params]);
  const result = stmt.step() ? stmt.getAsObject() : undefined;
  stmt.free();
  return result;
}

export function qAll(sql: string, params: any[] = []): any[] {
  const results: any[] = [];
  const database = getDb();
  const stmt = database.prepare(sql);
  stmt.bind(Array.isArray(params) ? params : [params]);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function qRun(sql: string, params: any[]): { changes: number; lastInsertRowid: number } {
  const database = getDb();
  const stmt = database.prepare(sql);
  stmt.run(Array.isArray(params) ? params : [params]);
  stmt.free();
  const idStmt = database.prepare('SELECT last_insert_rowid() as id');
  const idObj = idStmt.step() ? idStmt.getAsObject() : {};
  idStmt.free();
  const chStmt = database.prepare('SELECT changes() as c');
  const chObj = chStmt.step() ? chStmt.getAsObject() : {};
  chStmt.free();
  schedulePersist();
  return { changes: (chObj as any)?.c ?? 0, lastInsertRowid: (idObj as any)?.id ?? 0 };
}

export function closeDb(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  persist();
  if (db) {
    db.close();
    db = null;
  }
}

export function initDatabase(): void {
  // Connection is created lazily via ensureDb(); nothing to do synchronously.
  if (!db) {
    throw new Error('Database not initialized. Call await ensureDb() at startup.');
  }
}

export function runMigration(sql: string): void {
  const database = getDb();
  database.exec(sql);
  schedulePersist();
}

export function transaction<T>(fn: (db: SqlJsDatabase) => T): T {
  const database = getDb();
  database.run('BEGIN');
  try {
    const result = fn(database);
    database.run('COMMIT');
    persist();
    return result;
  } catch (e) {
    try { database.run('ROLLBACK'); } catch (_) { /* no-op */ }
    throw e;
  }
}

export function seedIfEmpty(): void {
  const database = getDb();
  let count: number;
  try {
    const row = database.prepare('SELECT COUNT(*) as c FROM categories');
    row.step();
    const rowData = row.getAsObject();
    row.free();
    count = (rowData && 'c' in rowData) ? rowData.c : 0;
  } catch {
    count = 0;
  }
  if (count === 0) {
    console.log('Database empty, running seed...');
    import('../db/seed.js')
      .then(m => m.seedDatabase())
      .catch(console.error);
  }
}

// --- Helpers that mimic better-sqlite3's API surface ---

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export function prepare(sql: string, database: SqlJsDatabase | null = null): { run: (...args: any[]) => RunResult; get: (...args: any[]) => any; all: (...args: any[]) => any[] } {
  const db = database || getDb();
  const stmt = db.prepare(sql);
  return {
    run: (...args: any[]) => {
      // sql.js expects args as a single array, not spread
      const params: any[] = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      stmt.run(params);
      // sql.js uses step()+getAsObject(), not .get()
      const lrStmt = db.prepare('SELECT last_insert_rowid() as id');
      const lr = lrStmt.step() ? lrStmt.getAsObject() : {};
      lrStmt.free();
      const chStmt = db.prepare('SELECT changes() as c');
      const ch = chStmt.step() ? chStmt.getAsObject() : {};
      chStmt.free();
      schedulePersist();
      return { changes: (ch as any)?.c ?? 0, lastInsertRowid: (lr as any)?.id ?? 0 };
    },
    get: (...args: any[]) => {
      const readStmt = db.prepare(sql);
      readStmt.bind(args.length === 1 && Array.isArray(args[0]) ? args[0] : args);
      if (readStmt.step()) return readStmt.getAsObject();
      readStmt.free();
      return undefined;
    },
    all: (...args: any[]) => {
      const results: any[] = [];
      // Always create a fresh statement for reads to avoid state issues
      const readStmt = db.prepare(sql);
      readStmt.bind(args.length === 1 && Array.isArray(args[0]) ? args[0] : args);
      while (readStmt.step()) {
        results.push(readStmt.getAsObject());
      }
      readStmt.free();
      return results;
    },
  };
}

// Check if this file is being run directly via CLI
// In ES modules, there's no direct equivalent of require.main, but we can check process.argv
// to see if the script is being executed directly rather than imported.
if (process.argv[1] && (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'))) {
  // Run CLI commands when executed directly
  const cmd = process.argv[2];
  if (cmd === 'seed') {
    import('./seed.js').then(m => m.seedDatabase().catch(console.error));
  } else if (cmd === '--help' || cmd === '-h') {
    console.log('Usage: tsx backend/src/db/index.ts [seed|--help|-h]');
    console.log('  seed   Run the database seeding script');
    console.log('  --help|-h Show this help message');
  }
}