import { qRun, qGet, qAll, getDb, ensureDb } from '../src/db/index.js';
import { initDatabase, resetDatabase } from '../src/db/init.js';
import { config } from '../src/config/index.js';
import { createUser, hashPassword, verifyPassword, createSession, getSession, getUserByEmail } from '../src/auth/index.js';

// Test config
const TEST_DB = ':memory:';
let originalDbPath = config.db.path;

beforeAll(async () => {
  // Override DB path for tests
  config.db.path = TEST_DB;
  await ensureDb();
  await initDatabase();
});

afterAll(() => {
  config.db.path = originalDbPath;
});

export function createTestUser(data: {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  isAdmin?: boolean;
} = {}) {
  const {
    email = 'test@example.com',
    password = 'TestPass123!',
    firstName = 'Test',
    lastName = 'User',
    phone = '+923001234567',
    isAdmin = false,
  } = data;

  const user = createUser(email, password, firstName, lastName, phone);
  if (isAdmin) {
    qRun('UPDATE users SET is_admin = 1 WHERE id = ?', [user.id]);
    user.is_admin = 1;
  }
  return user;
}

export function createAdminUser() {
  return createTestUser({ email: 'admin@test.com', firstName: 'Admin', lastName: 'User', isAdmin: true });
}

export function createSessionForUser(userId: number) {
  const user = getUserByEmail(createTestUser().email);
  if (!user) throw new Error('Test user not found');
  return createSession(user);
}

export function makeRequest(sessionToken?: string, headers: Record<string, string> = {}) {
  const req: any = {
    body: {},
    query: {},
    params: {},
    cookies: {},
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    method: 'GET',
    path: '/',
  };

  if (sessionToken) {
    req.cookies.session_token = sessionToken;
  }
  Object.assign(req.headers, headers);
  return req;
}

export function makeResponse() {
  const res: any = {
    statusCode: 200,
    headers: {},
    jsonBody: null,
    json(body: any) {
      this.jsonBody = body;
      this.statusCode = 200;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    cookie(name: string, value: string, _opts: any) {
      this.cookies = this.cookies || {};
      this.cookies[name] = value;
      return this;
    },
    clearCookie(name: string, _opts: any) {
      if (this.cookies) delete this.cookies[name];
      return this;
    },
    set(header: string, value: string) {
      this.headers[header] = value;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}
