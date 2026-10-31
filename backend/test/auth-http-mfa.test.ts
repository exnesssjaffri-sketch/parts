import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TOTP } from 'otpauth';

// Importing the app no longer binds a listening socket (startServer() only
// runs when backend/src/index.ts is the process entry point), so the test
// suite can mount the real Express app on an ephemeral 127.0.0.1 port.
import { app } from '../src/index.js';
import { ensureDb } from '../src/db/index.js';
import { initDatabase } from '../src/db/init.js';
import { config } from '../src/config/index.js';
import {
  createUser,
  generateMFASecret,
  enableMFA,
  verifyAndEnableMFA,
  getSession,
  __debugExpireChallengeToken,
} from '../src/auth/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = path.join(__dirname, '..', 'test-db');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

function getTestDbPath(name: string): string {
  return path.join(tmpDir, `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

let server: http.Server;
let mockSupabase: http.Server;
let baseUrl = '';
let oauthEmail = '';
let dbPath: string;

interface HttpResult {
  status: number;
  body: any;
  setCookie?: string;
}

async function httpPost(urlPath: string, body: any, cookie?: string): Promise<HttpResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  const response = await fetch(new URL(urlPath, baseUrl).toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return {
    status: response.status,
    body: json,
    setCookie: response.headers.get('set-cookie') ?? undefined,
  };
}

async function httpGet(urlPath: string, cookie?: string): Promise<HttpResult> {
  const headers: Record<string, string> = {};
  if (cookie) headers['Cookie'] = cookie;
  const response = await fetch(new URL(urlPath, baseUrl).toString(), { method: 'GET', headers });
  const json = await response.json().catch(() => ({}));
  return {
    status: response.status,
    body: json,
    setCookie: response.headers.get('set-cookie') ?? undefined,
  };
}

function sessionCookieValue(setCookie: string): string {
  return setCookie.split(';')[0].split('=').slice(1).join('=');
}

// Deterministic TOTP helper matching the server's verifyMFACode parameters.
function generateCode(secret: string): string {
  return new TOTP({ secret, digits: 6, period: 30 }).generate();
}

// Fully enroll a user in MFA: store the secret, then verify a real TOTP code
// so mfa_verified = 1 (mirrors the /mfa/setup + /mfa/verify production flow).
function enableVerifiedMFA(userId: number, secret: string): void {
  enableMFA(userId, secret);
  const ok = verifyAndEnableMFA(userId, generateCode(secret));
  if (!ok) throw new Error('Test setup failed: could not verify MFA enrollment code');
}

beforeAll(async () => {
  // Isolated test database, configured before the first ensureDb() call.
  dbPath = getTestDbPath('auth_http_mfa');
  config.db.path = dbPath;
  await ensureDb();
  await initDatabase();

  // Mock ONLY the external OAuth provider (Supabase token exchange + user
  // endpoint). MFA validation itself is never mocked.
  mockSupabase = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url?.startsWith('/auth/v1/token')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ session: { access_token: 'mock-access-token' } }));
    } else if (req.method === 'GET' && req.url?.startsWith('/auth/v1/user')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        email: oauthEmail,
        user_metadata: { first_name: 'OAuth', last_name: 'User' },
      }));
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end('{}');
    }
  });
  await new Promise<void>((resolve) => mockSupabase.listen(0, '127.0.0.1', resolve));
  config.supabase.url = `http://127.0.0.1:${(mockSupabase.address() as AddressInfo).port}`;

  // Start the real Express app on an ephemeral localhost port.
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
  await new Promise<void>((resolve) => {
    mockSupabase.closeAllConnections();
    mockSupabase.close(() => resolve());
  });
  // Let the debounced db persist flush before deleting the test database.
  await new Promise((resolve) => setTimeout(resolve, 300));
  try { fs.unlinkSync(dbPath); } catch {}
});

describe('Auth HTTP Routes - MFA Regression Tests', () => {
  it('1. Normal password login for non-MFA user should return a valid session', async () => {
    const email = 'normaluser@test.com';
    const password = 'TestPass123!';
    const user = createUser(email, password, 'Normal', 'User');

    const res = await httpPost('/api/auth/login', { email, password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mfa_required).toBe(false);
    expect(res.body.user).toBeDefined();
    expect(res.body.challenge_token).toBeFalsy();
    expect(res.setCookie).toBeTruthy();
    expect(res.setCookie).toContain('session_token=');

    const cookieValue = sessionCookieValue(res.setCookie!);
    const session = getSession(cookieValue);
    expect(session).toBeTruthy();
    expect(session!.userId).toBe(user.id);
    expect(session!.mfaPending).toBe(false);
  });

  it('2. MFA-enabled password login should return mfa_required and challenge token, no session', async () => {
    const email = 'mfauser@test.com';
    const password = 'MfaPass123!';
    const user = createUser(email, password, 'Mfa', 'User');
    const secret = generateMFASecret();
    enableVerifiedMFA(user.id, secret);

    const res = await httpPost('/api/auth/login', { email, password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mfa_required).toBe(true);
    expect(res.body.challenge_token).toBeDefined();
    expect(res.setCookie).toBeFalsy();
  });

  it('3. Valid challenge token + valid TOTP should create authenticated session', async () => {
    const email = 'mfauser3@test.com';
    const password = 'MfaPass3123!';
    const user = createUser(email, password, 'Mfa3', 'User');
    const secret = generateMFASecret();
    enableVerifiedMFA(user.id, secret);

    const loginRes = await httpPost('/api/auth/login', { email, password });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.mfa_required).toBe(true);
    const challengeToken = loginRes.body.challenge_token;
    expect(loginRes.setCookie).toBeFalsy();

    const challengeRes = await httpPost('/api/auth/mfa/challenge', {
      email,
      password,
      code: generateCode(secret),
      challenge_token: challengeToken,
    });

    expect(challengeRes.status).toBe(200);
    expect(challengeRes.body.success).toBe(true);
    expect(challengeRes.setCookie).toBeTruthy();
    expect(challengeRes.setCookie).toContain('session_token=');

    const cookieValue = sessionCookieValue(challengeRes.setCookie!);
    const session = getSession(cookieValue);
    expect(session).toBeTruthy();
    expect(session!.userId).toBe(user.id);
    expect(session!.mfaPending).toBe(false);
  });

  it('4. Invalid TOTP should be rejected and challenge token consumed', async () => {
    const email = 'mfauser4@test.com';
    const password = 'MfaPass4123!';
    const user = createUser(email, password, 'Mfa4', 'User');
    const secret = generateMFASecret();
    enableVerifiedMFA(user.id, secret);

    const loginRes = await httpPost('/api/auth/login', { email, password });
    const challengeToken = loginRes.body.challenge_token;

    const challengeRes = await httpPost('/api/auth/mfa/challenge', {
      email,
      password,
      code: '000000',
      challenge_token: challengeToken,
    });

    expect(challengeRes.status).toBe(401);
    expect(challengeRes.body.error).toBe('Unauthorized');
    expect(challengeRes.setCookie).toBeFalsy();

    // The single-use token was consumed by the failed attempt; retry is rejected.
    const retryRes = await httpPost('/api/auth/mfa/challenge', {
      email,
      password,
      code: generateCode(secret),
      challenge_token: challengeToken,
    });
    expect(retryRes.status).toBe(401);
    expect(retryRes.body.message).toContain('Invalid, expired, or already used');
  });

  it('5. Expired challenge token should be rejected', async () => {
    const email = 'mfauser5@test.com';
    const password = 'MfaPass5123!';
    const user = createUser(email, password, 'Mfa5', 'User');
    const secret = generateMFASecret();
    enableVerifiedMFA(user.id, secret);

    const loginRes = await httpPost('/api/auth/login', { email, password });
    const challengeToken = loginRes.body.challenge_token;

    // Deterministically expire the token in the server-side store (same process).
    expect(__debugExpireChallengeToken(challengeToken)).toBe(true);

    const challengeRes = await httpPost('/api/auth/mfa/challenge', {
      email,
      password,
      code: generateCode(secret),
      challenge_token: challengeToken,
    });

    expect(challengeRes.status).toBe(401);
    expect(challengeRes.body.message).toContain('Invalid, expired, or already used');
    expect(challengeRes.setCookie).toBeFalsy();
  });

  it('6. Consumed challenge token cannot be reused', async () => {
    const email = 'mfauser6@test.com';
    const password = 'MfaPass6123!';
    const user = createUser(email, password, 'Mfa6', 'User');
    const secret = generateMFASecret();
    enableVerifiedMFA(user.id, secret);

    const loginRes = await httpPost('/api/auth/login', { email, password });
    const challengeToken = loginRes.body.challenge_token;

    // Consume the token with a valid code (successful MFA login).
    const firstRes = await httpPost('/api/auth/mfa/challenge', {
      email,
      password,
      code: generateCode(secret),
      challenge_token: challengeToken,
    });
    expect(firstRes.status).toBe(200);
    expect(firstRes.body.success).toBe(true);

    // Replaying the same token must fail even with a fresh valid code.
    const retryRes = await httpPost('/api/auth/mfa/challenge', {
      email,
      password,
      code: generateCode(secret),
      challenge_token: challengeToken,
    });
    expect(retryRes.status).toBe(401);
    expect(retryRes.body.message).toContain('Invalid, expired, or already used');
  });

  it('7. Challenge token issued to User A cannot authenticate User B', async () => {
    const emailA = 'mfausera@test.com';
    const passwordA = 'MfaPassA123!';
    const userA = createUser(emailA, passwordA, 'MfaA', 'User');
    const secretA = generateMFASecret();
    enableVerifiedMFA(userA.id, secretA);

    const emailB = 'mfauserb@test.com';
    const passwordB = 'MfaPassB123!';
    const userB = createUser(emailB, passwordB, 'MfaB', 'User');
    const secretB = generateMFASecret();
    enableVerifiedMFA(userB.id, secretB);

    const loginResA = await httpPost('/api/auth/login', { email: emailA, password: passwordA });
    const challengeTokenA = loginResA.body.challenge_token;

    // Use User A's challenge token together with User B's valid credentials and TOTP.
    const attackRes = await httpPost('/api/auth/mfa/challenge', {
      email: emailB,
      password: passwordB,
      code: generateCode(secretB),
      challenge_token: challengeTokenA,
    });

    expect(attackRes.status).toBe(401);
    expect(attackRes.body.message).toContain('Invalid, expired, or already used');
    expect(attackRes.setCookie).toBeFalsy();

    // User B can still complete their own login flow afterwards.
    const loginResB = await httpPost('/api/auth/login', { email: emailB, password: passwordB });
    const okRes = await httpPost('/api/auth/mfa/challenge', {
      email: emailB,
      password: passwordB,
      code: generateCode(secretB),
      challenge_token: loginResB.body.challenge_token,
    });
    expect(okRes.status).toBe(200);
  });

  it('8. Challenge token cannot access protected endpoints', async () => {
    const email = 'mfauser8@test.com';
    const password = 'MfaPass8123!';
    const user = createUser(email, password, 'Mfa8', 'User');
    const secret = generateMFASecret();
    enableVerifiedMFA(user.id, secret);

    const loginRes = await httpPost('/api/auth/login', { email, password });
    const challengeToken = loginRes.body.challenge_token;

    // Present the challenge token as if it were a session cookie.
    const meRes = await httpGet('/api/auth/me', `session_token=${challengeToken}`);
    expect(meRes.status).toBe(401);
    expect(meRes.body.error).toBe('Unauthorized');

    // Also as a bearer token.
    const bearerRes = await fetch(new URL('/api/auth/me', baseUrl).toString(), {
      headers: { Authorization: `Bearer ${challengeToken}` },
    });
    expect(bearerRes.status).toBe(401);
  });

  it('9. Five failed attempts should invalidate the challenge', async () => {
    const email = 'mfauser9@test.com';
    const password = 'MfaPass9123!';
    const user = createUser(email, password, 'Mfa9', 'User');
    const secret = generateMFASecret();
    enableVerifiedMFA(user.id, secret);

    const loginRes = await httpPost('/api/auth/login', { email, password });
    const challengeToken = loginRes.body.challenge_token;

    // Single-use enforcement: the first wrong code consumes the token, and
    // every subsequent attempt (through and beyond the 5-attempt cap) is rejected.
    for (let i = 0; i < 5; i++) {
      const res = await httpPost('/api/auth/mfa/challenge', {
        email,
        password,
        code: '000000',
        challenge_token: challengeToken,
      });
      expect(res.status).toBe(401);
      expect(res.setCookie).toBeFalsy();
    }

    const finalRes = await httpPost('/api/auth/mfa/challenge', {
      email,
      password,
      code: generateCode(secret),
      challenge_token: challengeToken,
    });
    expect(finalRes.status).toBe(401);
    expect(finalRes.body.message).toContain('Invalid, expired, or already used');
  });

  it('10. Google OAuth login should follow MFA rules', async () => {
    // Non-MFA OAuth user gets a session directly.
    oauthEmail = 'oauthuser@test.com';
    const res = await httpPost('/api/auth/google/callback', { code: 'mock-google-code' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mfa_required).toBeFalsy();
    expect(res.setCookie).toBeTruthy();
    expect(res.setCookie).toContain('session_token=');

    // MFA-enabled OAuth user gets a challenge token and no session.
    oauthEmail = 'oauthmfa@test.com';
    const mfaUser = createUser('oauthmfa@test.com', '', 'OAuthMfa', 'User');
    const secret = generateMFASecret();
    enableVerifiedMFA(mfaUser.id, secret);

    const mfaRes = await httpPost('/api/auth/google/callback', { code: 'mock-google-code' });
    expect(mfaRes.status).toBe(200);
    expect(mfaRes.body.success).toBe(true);
    expect(mfaRes.body.mfa_required).toBe(true);
    expect(mfaRes.body.challenge_token).toBeDefined();
    expect(mfaRes.setCookie).toBeFalsy();
  });

  it('11. Non-MFA user should not be forced through MFA flow', async () => {
    const email = 'nomfauser@test.com';
    const password = 'NoMfaPass123!';
    createUser(email, password, 'NoMfa', 'User');

    const loginRes = await httpPost('/api/auth/login', { email, password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.mfa_required).toBe(false);
    expect(loginRes.body.challenge_token).toBeFalsy();
    expect(loginRes.setCookie).toBeTruthy();
  });

  it('12. Logout should invalidate authenticated session', async () => {
    const email = 'logoutuser@test.com';
    const password = 'LogoutPass123!';
    createUser(email, password, 'Logout', 'User');

    const loginRes = await httpPost('/api/auth/login', { email, password });
    expect(loginRes.setCookie).toBeTruthy();
    const cookieValue = sessionCookieValue(loginRes.setCookie!);
    expect(getSession(cookieValue)).toBeTruthy();

    const logoutRes = await httpPost('/api/auth/logout', {}, `session_token=${cookieValue}`);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    expect(getSession(cookieValue)).toBeFalsy();

    // The invalidated session can no longer access protected endpoints.
    const meRes = await httpGet('/api/auth/me', `session_token=${cookieValue}`);
    expect(meRes.status).toBe(401);
  });
});