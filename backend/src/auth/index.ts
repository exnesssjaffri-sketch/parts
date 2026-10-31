import crypto from 'crypto';
import { getDb, qRun, qGet } from '../db/index.js';
import { config } from '../config/index.js';
import { TOTP, Secret } from 'otpauth';

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_admin: number;
  is_active: number;
  email_verified: number;
  mfa_secret: string | null;
  mfa_verified: number;
  created_at: string;
}

export interface SessionData {
  userId: number;
  email: string;
  isAdmin: boolean;
  expiresAt: number;
  mfaPending?: boolean;
}

const sessions = new Map<string, SessionData>();

// Dedicated challenge token store — separate from sessions with independent TTL
interface ChallengeRecord {
  userId: number;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
}
const CHALLENGE_TTL_MS = 120_000; // 2 minutes
const CHALLENGE_MAX_ATTEMPTS = 5;
const challenges = new Map<string, ChallengeRecord>();

export function generateChallengeToken(userId: number): string {
  const token = generateToken();
  const now = Date.now();
  challenges.set(token, {
    userId,
    createdAt: now,
    expiresAt: now + CHALLENGE_TTL_MS,
    attempts: 0,
    maxAttempts: CHALLENGE_MAX_ATTEMPTS,
  });
  return token;
}

/** Read the user bound to a live challenge token; never accept identity from the client. */
export function getChallengeTokenUserId(token: string): number | null {
  const record = challenges.get(token);
  if (!record) return null;
  if (record.expiresAt < Date.now() || record.attempts >= record.maxAttempts) {
    challenges.delete(token);
    return null;
  }
  return record.userId;
}

/** Count a failed TOTP attempt and invalidate the challenge at the configured limit. */
export function recordChallengeAttempt(token: string): boolean {
  const record = challenges.get(token);
  if (!record || record.expiresAt < Date.now()) {
    challenges.delete(token);
    return false;
  }
  record.attempts += 1;
  if (record.attempts >= record.maxAttempts) challenges.delete(token);
  return true;
}

export function consumeChallengeToken(token: string): boolean {
  const record = challenges.get(token);
  if (!record) return false;
  if (record.expiresAt < Date.now()) {
    challenges.delete(token);
    return false;
  }
  if (record.attempts >= record.maxAttempts) {
    challenges.delete(token);
    return false;
  }
  challenges.delete(token);
  return true;
}

/**
 * Validate and atomically consume a challenge token, binding it to the
 * authenticating user. A token issued for a different user must never be
 * usable to complete another user's MFA flow.
 */
export function consumeChallengeTokenForUser(token: string, userId: number): boolean {
  const record = challenges.get(token);
  if (!record) return false;
  if (record.expiresAt < Date.now()) {
    challenges.delete(token);
    return false;
  }
  if (record.attempts >= record.maxAttempts) {
    challenges.delete(token);
    return false;
  }
  if (record.userId !== userId) {
    // Don't consume — let the attacker try again, but count the attempt
    record.attempts++;
    if (record.attempts >= record.maxAttempts) {
      challenges.delete(token);
    }
    return false;
  }
  challenges.delete(token);
  return true;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(computedHash));
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function createSession(user: User, options?: { mfaPending?: boolean }): string {
  const token = generateToken();
  const expiresAt = Date.now() + config.security.tokenTtl * 1000;
  sessions.set(token, {
    userId: user.id,
    email: user.email,
    isAdmin: user.is_admin === 1,
    expiresAt,
    mfaPending: options?.mfaPending ?? false,
  });
  return token;
}

export function getSession(token: string): SessionData | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}

export function getUserByEmail(email: string): User | null {
  return qGet('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]) as User | null;
}

export function getUserById(id: number): User | null {
  return qGet('SELECT * FROM users WHERE id = ? AND is_active = 1', [id]) as User | null;
}

export function createUser(email: string, password: string, firstName: string, lastName: string, phone?: string): User {
  const passwordHash = hashPassword(password);
  const result = qRun(`
    INSERT INTO users (email, password_hash, first_name, last_name, phone, is_active, email_verified)
    VALUES (?, ?, ?, ?, ?, 1, 0)
  `, [email, passwordHash, firstName, lastName, phone ?? null]);

  return getUserById(result.lastInsertRowid)!;
}

export function updateUserProfile(userId: number, data: { first_name?: string; last_name?: string; phone?: string }): User | null {
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (data.first_name) { fields.push('first_name = ?'); values.push(data.first_name); }
  if (data.last_name) { fields.push('last_name = ?'); values.push(data.last_name); }
  if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }

  if (fields.length === 0) return getUserById(userId);

  fields.push('updated_at = datetime("now")');
  values.push(userId);

  qRun(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  return getUserById(userId);
}

export function changePassword(userId: number, currentPassword: string, newPassword: string): boolean {
  const user = qGet('SELECT password_hash FROM users WHERE id = ?', [userId]) as { password_hash: string } | null;
  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    return false;
  }
  const newHash = hashPassword(newPassword);
  qRun('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?', [newHash, userId]);
  return true;
}

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(token);
    }
  }
}, 60000); // every minute

export function getSessionCount(): number {
  return sessions.size;
}

export function generateMFASecret(): string {
  const secret = new Secret();
  return secret.base32;
}

export function generateMFAQRCodeURI(secret: string, email: string, name: string): string {
  const totp = new TOTP({
    issuer: 'AutoMarts',
    label: `${name} <${email}>`,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: secret,
  });
  return totp.toString();
}

export function verifyMFACode(secret: string, code: string, window: number = 1): boolean {
  const totp = new TOTP({
    issuer: 'AutoMarts',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: secret,
  });
  const result = totp.validate({ token: code, window });
  return result !== null;
}

export function enableMFA(userId: number, secret: string): boolean {
  const result = qRun('UPDATE users SET mfa_secret = ?, mfa_verified = 0, updated_at = datetime("now") WHERE id = ?', [secret, userId]);
  return result.changes > 0;
}

export function verifyAndEnableMFA(userId: number, code: string): boolean {
  const user = qGet('SELECT mfa_secret FROM users WHERE id = ? AND mfa_secret IS NOT NULL', [userId]) as { mfa_secret: string } | null;
  if (!user || !user.mfa_secret) return false;
  if (!verifyMFACode(user.mfa_secret, code)) return false;
  const result = qRun('UPDATE users SET mfa_verified = 1, updated_at = datetime("now") WHERE id = ?', [userId]);
  return result.changes > 0;
}

export function disableMFA(userId: number, code: string): boolean {
  const user = qGet('SELECT mfa_secret FROM users WHERE id = ? AND mfa_secret IS NOT NULL', [userId]) as { mfa_secret: string } | null;
  if (!user || !user.mfa_secret) return false;
  if (!verifyMFACode(user.mfa_secret, code)) return false;
  const result = qRun('UPDATE users SET mfa_secret = NULL, mfa_verified = 0, updated_at = datetime("now") WHERE id = ?', [userId]);
  return result.changes > 0;
}

export function requireMFAForAction(userId: number): boolean {
  const user = qGet('SELECT mfa_verified FROM users WHERE id = ?', [userId]) as { mfa_verified: number } | null;
  return user !== null && user.mfa_verified === 1;
}

/**
 * Test-only helper that forces an existing challenge token to be expired.
 * This is a process-local debug escape hatch for the in-memory challenge
 * store; it is not exposed over any network path and does not weaken the
 * single-use/expiry guarantees enforced by consumeChallengeTokenForUser.
 */
export function __debugExpireChallengeToken(token: string): boolean {
  const record = challenges.get(token);
  if (!record) return false;
  record.expiresAt = Date.now() - 1000;
  return true;
}