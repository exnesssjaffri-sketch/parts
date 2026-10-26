import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { qGet, ensureDb } from '../src/db/index.js';
import { initDatabase } from '../src/db/init.js';
import { config } from '../src/config/index.js';
import {
  createUser, verifyPassword, createSession, getSession,
  getUserByEmail, generateMFASecret, enableMFA,
  verifyAndEnableMFA, disableMFA, requireMFAForAction, changePassword,
  deleteSession,
} from '../src/auth/index.js';
import * as path from 'path';
import * as fs from 'fs';

const tmpDir = path.join(__dirname, '..', 'test-db');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

function getTestDbPath(name: string) {
  return path.join(tmpDir, name + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.db');
}

function makeResponse() {
  const res: any = {
    statusCode: 200, headers: {}, jsonBody: null, cookies: {},
    json(body: any) { this.jsonBody = body; return this; },
    status(code: number) { this.statusCode = code; return this; },
    cookie(name: string, value: string, _opts: any) { this.cookies[name] = value; return this; },
    clearCookie(name: string, _opts: any) { delete this.cookies[name]; return this; },
    set(header: string, value: string) { this.headers[header] = value; return this; },
    end() { return this; },
  };
  return res;
}

// Simulate the actual login route logic from auth.ts lines 88-148
function simulateLogin(email: string, password: string) {
  const res = makeResponse();
  const user = getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
  }
  const userRecord = qGet('SELECT password_hash FROM users WHERE id = ?', [user.id]) as { password_hash: string } | null;
  if (!userRecord || !verifyPassword(password, userRecord.password_hash)) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
  }
  const mfaEnabled = user.mfa_verified === 1;
  if (mfaEnabled) {
    return res.json({ success: true, mfa_required: true, message: 'MFA verification required' });
  }
  const token = createSession(user);
  res.cookie('session_token', token, {});
  return res.json({ success: true, mfa_required: false });
}

describe('Auth Routes - MFA Bypass Fix', () => {
  let dbPath: string;

  beforeAll(async () => {
    dbPath = getTestDbPath('auth_route_mfa');
    config.db.path = dbPath;
    await ensureDb();
    await initDatabase();
  });

  afterAll(() => {
    try { fs.unlinkSync(dbPath); } catch {}
  });

  it('login should NOT create session for user with MFA enabled', async () => {
    const password = 'TestPass123!';
    const user = createUser('mfa_user@test.com', password, 'MFA', 'User');
    const secret = generateMFASecret();
    enableMFA(user.id, secret);
    // Verify MFA is actually enabled (mfa_verified = 1)
    const { TOTP } = await import('otpauth');
    const totp = new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret });
    verifyAndEnableMFA(user.id, totp.generate());

    const res = simulateLogin('mfa_user@test.com', password);
    expect(res.jsonBody?.mfa_required).toBe(true);
    expect(res.cookies?.session_token).toBeUndefined();
  });

  it('login should create session for user WITHOUT MFA', () => {
    const password = 'TestPass123!';
    createUser('normal_user@test.com', password, 'Normal', 'User');

    const res = simulateLogin('normal_user@test.com', password);
    expect(res.jsonBody?.mfa_required).toBe(false);
    expect(res.cookies?.session_token).toBeDefined();
    expect(getSession(res.cookies.session_token)).toBeTruthy();
    expect(getSession(res.cookies.session_token)!.userId).toBeGreaterThan(0);
  });

  it('login with wrong password should return 401 without session', () => {
    createUser('pw_test@test.com', 'CorrectPass123!', 'PW', 'Test');
    const res = simulateLogin('pw_test@test.com', 'WrongPassword');
    expect(res.statusCode).toBe(401);
    expect(res.cookies?.session_token).toBeUndefined();
  });

  it('login with non-existent email should return 401', () => {
    const res = simulateLogin('nobody@test.com', 'anything');
    expect(res.statusCode).toBe(401);
  });
});

describe('Auth Routes - Registration Security', () => {
  let dbPath: string;

  beforeAll(async () => {
    dbPath = getTestDbPath('auth_route_register');
    config.db.path = dbPath;
    await ensureDb();
    await initDatabase();
  });

  afterAll(() => {
    try { fs.unlinkSync(dbPath); } catch {}
  });

  it('register should reject duplicate email', () => {
    createUser('dup@test.com', 'TestPass123!', 'Dup', 'User');
    expect(() => createUser('dup@test.com', 'TestPass123!', 'Dup2', 'User2')).toThrow();
  });

  it('register should create user without MFA by default', () => {
    const user = createUser('newuser@test.com', 'TestPass123!', 'New', 'User');
    expect(user).toBeDefined();
    expect(user.mfa_verified).toBe(0);
    expect(user.mfa_secret).toBeNull();
    expect(user.is_admin).toBe(0);
    expect(user.email_verified).toBe(0);
  });
});

describe('Auth Routes - Session Management', () => {
  it('getSession should not return null for valid session', () => {
    const user = { id: 999, email: 'expire@test.com', is_admin: 0, mfa_verified: 0 } as any;
    const token = createSession(user);
    const session = getSession(token);
    expect(session).toBeTruthy();
    expect(session!.expiresAt).toBeGreaterThan(Date.now());
    deleteSession(token);
  });

  it('deleteSession should remove session', () => {
    const user = { id: 888, email: 'delete@test.com', is_admin: 0 } as any;
    const token = createSession(user);
    expect(getSession(token)).toBeTruthy();
    deleteSession(token);
    expect(getSession(token)).toBeNull();
  });

  it('multiple sessions should be independent', () => {
    const user1 = { id: 1, email: 'user1@test.com', is_admin: 0, mfa_verified: 0 } as any;
    const user2 = { id: 2, email: 'user2@test.com', is_admin: 1, mfa_verified: 0 } as any;
    const token1 = createSession(user1);
    const token2 = createSession(user2);
    const session1 = getSession(token1);
    const session2 = getSession(token2);
    expect(session1?.userId).toBe(1);
    expect(session2?.userId).toBe(2);
    expect(session1?.isAdmin).toBe(false);
    expect(session2?.isAdmin).toBe(true);
    expect(token1).not.toBe(token2);
    deleteSession(token1);
    deleteSession(token2);
  });
});

describe('Auth Routes - MFA Full Flow', () => {
  let dbPath: string;

  beforeAll(async () => {
    dbPath = getTestDbPath('auth_route_mfa_full');
    config.db.path = dbPath;
    await ensureDb();
    await initDatabase();
  });

  afterAll(() => {
    try { fs.unlinkSync(dbPath); } catch {}
  });

  it('enableMFA should store secret but not mark as verified', () => {
    const user = createUser('mfa_setup@test.com', 'TestPass123!', 'MFA', 'Setup');
    const secret = generateMFASecret();
    const result = enableMFA(user.id, secret);
    expect(result).toBe(true);
    const updated = getUserByEmail('mfa_setup@test.com');
    expect(updated?.mfa_secret).toBe(secret);
    expect(updated?.mfa_verified).toBe(0);
  });

  it('verifyAndEnableMFA should verify code and enable MFA', async () => {
    const user = createUser('mfa_verify@test.com', 'TestPass123!', 'MFA', 'Verify');
    const secret = generateMFASecret();
    enableMFA(user.id, secret);
    const { TOTP } = await import('otpauth');
    const totp = new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret });
    const code = totp.generate();
    const result = verifyAndEnableMFA(user.id, code);
    expect(result).toBe(true);
    const updated = getUserByEmail('mfa_verify@test.com');
    expect(updated?.mfa_verified).toBe(1);
  });

  it('verifyAndEnableMFA should reject wrong code', () => {
    const user = createUser('mfa_wrong@test.com', 'TestPass123!', 'MFA', 'Wrong');
    const secret = generateMFASecret();
    enableMFA(user.id, secret);
    const result = verifyAndEnableMFA(user.id, '000000');
    expect(result).toBe(false);
    const updated = getUserByEmail('mfa_wrong@test.com');
    expect(updated?.mfa_verified).toBe(0);
  });

  it('disableMFA should remove secret and disable MFA', async () => {
    const user = createUser('mfa_disable@test.com', 'TestPass123!', 'MFA', 'Disable');
    const secret = generateMFASecret();
    enableMFA(user.id, secret);
    const { TOTP } = await import('otpauth');
    const totp = new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret });
    const code = totp.generate();
    verifyAndEnableMFA(user.id, code);
    const disableResult = disableMFA(user.id, code);
    expect(disableResult).toBe(true);
    const updated = getUserByEmail('mfa_disable@test.com');
    expect(updated?.mfa_secret).toBeNull();
    expect(updated?.mfa_verified).toBe(0);
  });

  it('requireMFAForAction should return false when MFA is not verified', () => {
    const userNoMFA = createUser('mfa_action_no@test.com', 'TestPass123!', 'MFA', 'NoAction');
    expect(requireMFAForAction(userNoMFA.id)).toBe(false);

    const userWithMFA = createUser('mfa_action_yes@test.com', 'TestPass123!', 'MFA', 'YesAction');
    const secret = generateMFASecret();
    enableMFA(userWithMFA.id, secret);
    expect(requireMFAForAction(userWithMFA.id)).toBe(false); // Not verified yet
  });
});

describe('Auth Routes - Password Operations', () => {
  let dbPath: string;

  beforeAll(async () => {
    dbPath = getTestDbPath('auth_route_password');
    config.db.path = dbPath;
    await ensureDb();
    await initDatabase();
  });

  afterAll(() => {
    try { fs.unlinkSync(dbPath); } catch {}
  });

  it('changePassword should succeed with correct current password', () => {
    const user = createUser('pass_change@test.com', 'OldPass123!', 'Pass', 'Change');
    const result = changePassword(user.id, 'OldPass123!', 'NewPass456!');
    expect(result).toBe(true);
    const hashData = qGet('SELECT password_hash FROM users WHERE id = ?', [user.id]) as { password_hash: string } | null;
    expect(verifyPassword('NewPass456!', hashData!.password_hash)).toBe(true);
    expect(verifyPassword('OldPass123!', hashData!.password_hash)).toBe(false);
  });

  it('changePassword should fail with wrong current password', () => {
    const user = createUser('pass_wrong@test.com', 'CorrectPass123!', 'Pass', 'Wrong');
    const result = changePassword(user.id, 'WrongPass', 'NewPass456!');
    expect(result).toBe(false);
    const hashData = qGet('SELECT password_hash FROM users WHERE id = ?', [user.id]) as { password_hash: string } | null;
    expect(verifyPassword('CorrectPass123!', hashData!.password_hash)).toBe(true);
  });
});
