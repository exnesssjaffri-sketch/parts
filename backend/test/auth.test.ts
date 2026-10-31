import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { qRun, ensureDb, getDb } from '../src/db/index.js';
import { initDatabase } from '../src/db/init.js';
import { config } from '../src/config/index.js';
import { createUser, hashPassword, verifyPassword, getUserByEmail, getUserById, createSession, getSession, deleteSession, generateMFASecret, generateMFAQRCodeURI, verifyMFACode, generateChallengeToken, consumeChallengeToken } from '../src/auth/index.js';
import * as path from 'path';
import * as fs from 'fs';

const tmpDir = path.join(__dirname, '..', 'test-db');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

function getTestDbPath(name) {
  return path.join(tmpDir, name + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.db');
}

describe('Auth Module - Password Operations', () => {
  it('hashPassword should create a salted hash', () => {
    const hash1 = hashPassword('test123');
    const hash2 = hashPassword('test123');
    expect(hash1).toContain(':');
    expect(hash2).toContain(':');
    expect(hash1).not.toBe(hash2);
  });

  it('verifyPassword should validate correct password', () => {
    const hash = hashPassword('correctpassword');
    expect(verifyPassword('correctpassword', hash)).toBe(true);
  });

  it('verifyPassword should reject wrong password', () => {
    const hash = hashPassword('correctpassword');
    expect(verifyPassword('wrongpassword', hash)).toBe(false);
  });

  it('verifyPassword should handle malformed hash', () => {
    expect(verifyPassword('any', 'invalidhash')).toBe(false);
    expect(verifyPassword('any', 'onlysalt:')).toBe(false);
  });
});

describe('Auth Module - User Operations', () => {
  let dbPath;
  beforeAll(async () => {
    dbPath = getTestDbPath('auth_users');
    config.db.path = dbPath;
    await ensureDb();
    await initDatabase();
  });

  afterAll(() => {
    try { fs.unlinkSync(dbPath); } catch {}
  });

  it('createUser should insert and return user', () => {
    const user = createUser('alice@test.com', 'Password123!', 'Alice', 'Smith');
    expect(user).toBeDefined();
    expect(user.id).toBeGreaterThan(0);
    expect(user.email).toBe('alice@test.com');
    expect(user.first_name).toBe('Alice');
    expect(user.is_admin).toBe(0);
    expect(user.mfa_secret).toBeNull();
    expect(user.mfa_verified).toBe(0);
  });

  it('getUserByEmail should find existing user', () => {
    const user = getUserByEmail('alice@test.com');
    expect(user).toBeDefined();
    expect(user?.email).toBe('alice@test.com');
  });

  it('getUserByEmail should return null for non-existent user', () => {
    const user = getUserByEmail('nonexistent@test.com');
    expect(user).toBeFalsy();
  });

  it('getUserById should find existing user', () => {
    const existing = getUserByEmail('alice@test.com');
    const byId = getUserById(existing!.id);
    expect(byId).toBeDefined();
    expect(byId?.id).toBe(existing!.id);
  });

  it('createUser with phone should store phone', () => {
    const user = createUser('bob@test.com', 'Password123!', 'Bob', 'Jones', '+923001234567');
    expect(user.phone).toBe('+923001234567');
  });

  it('createUser without phone should have null phone', () => {
    const user = createUser('carol@test.com', 'Password123!', 'Carol', 'Davis');
    expect(user.phone).toBeNull();
  });
});

describe('Auth Module - Session Management', () => {
  it('createSession should create a session token', () => {
    const user = { id: 1, email: 'test@example.com', is_admin: 1 } as any;
    const token = createSession(user);
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThan(0);
  });

  it('getSession should return session data for valid token', () => {
    const user = { id: 2, email: 'test2@example.com', is_admin: 0 } as any;
    const token = createSession(user);
    const session = getSession(token);
    expect(session).toBeDefined();
    expect(session?.userId).toBe(2);
    expect(session?.email).toBe('test2@example.com');
    expect(session?.isAdmin).toBe(false);
  });

  it('getSession should return null for invalid token', () => {
    expect(getSession('invalid-token-12345')).toBeNull();
  });

  it('deleteSession should remove session', () => {
    const user = { id: 3, email: 'test3@example.com', is_admin: 0 } as any;
    const token = createSession(user);
    deleteSession(token);
    expect(getSession(token)).toBeNull();
  });
});

describe('Auth Module - MFA Functions', () => {
  it('generateMFASecret should return a base32 secret', () => {
    const secret = generateMFASecret();
    expect(secret).toBeDefined();
    expect(secret.length).toBeGreaterThan(0);
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
  });

  it('generateMFAQRCodeURI should return a valid URI', () => {
    const secret = generateMFASecret();
    const uri = generateMFAQRCodeURI(secret, 'user@test.com', 'Test User');
    expect(uri).toContain('otpauth://totp');
    expect(uri).toContain('AutoMarts');
  });

  it('verifyMFACode should validate correct code for secret', async () => {
    const secret = generateMFASecret();
    const { TOTP } = await import('otpauth');
    const totp = new TOTP({ secret, digits: 6, period: 30 });
    const code = totp.generate();
    expect(verifyMFACode(secret, code)).toBe(true);
  });

  it('verifyMFACode should reject invalid code', () => {
    const secret = generateMFASecret();
    expect(verifyMFACode(secret, '000000')).toBe(false);
  });
});

describe('Auth Module - MFA Challenge Flow', () => {
  it('createSession with mfaPending flag should persist the flag', () => {
    const user = { id: 10, email: 'mfa-test@example.com', is_admin: 0 } as any;
    const token = createSession(user, { mfaPending: true });
    const session = getSession(token);
    expect(session).toBeDefined();
    expect(session?.mfaPending).toBe(true);
    expect(session?.userId).toBe(10);
  });

  it('getSession should not have mfaPending flag for normal session', () => {
    const user = { id: 11, email: 'normal@example.com', is_admin: 0 } as any;
    const token = createSession(user);
    const session = getSession(token);
    expect(session?.mfaPending).toBe(false);
  });

  it('non-MFA user login should not require MFA challenge', () => {
    const user = { id: 12, email: 'nomfa@example.com', is_admin: 0, mfa_verified: 0 } as any;
    const token = createSession(user);
    const session = getSession(token);
    expect(session?.mfaPending).toBe(false);
    expect(session?.userId).toBe(12);
  });
});

describe('Auth Module - Challenge Token Store', () => {
  it('generateChallengeToken should create a unique token', () => {
    const token1 = generateChallengeToken(42);
    const token2 = generateChallengeToken(42);
    expect(token1).toBeDefined();
    expect(token2).toBeDefined();
    expect(token1).not.toBe(token2);
  });

  it('consumeChallengeToken should succeed for valid token', () => {
    const token = generateChallengeToken(99);
    expect(consumeChallengeToken(token)).toBe(true);
  });

  it('consumeChallengeToken should fail for invalid token', () => {
    expect(consumeChallengeToken('nonexistent-token')).toBe(false);
  });

  it('consumeChallengeToken should fail for already consumed token', () => {
    const token = generateChallengeToken(77);
    expect(consumeChallengeToken(token)).toBe(true);
    expect(consumeChallengeToken(token)).toBe(false);
  });

  it('consumeChallengeToken should return false after consumption', () => {
    const token = generateChallengeToken(55);
    consumeChallengeToken(token);
    expect(consumeChallengeToken(token)).toBe(false);
  });
});
