import { Router, Request, Response } from 'express';
import { getDb, qGet } from '../db/index.js';
import { authRequired, validateBody, rateLimit } from '../middleware/index.js';
import { z } from 'zod';
import { hashPassword, verifyPassword, createSession, getSession, deleteSession, getUserByEmail, getUserById, createUser, updateUserProfile, changePassword, generateMFASecret, generateMFAQRCodeURI, verifyMFACode, enableMFA, verifyAndEnableMFA, disableMFA, requireMFAForAction } from '../auth/index.js';
import { config } from '../config/index.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  first_name: z.string().min(1).max(50),
  last_name: z.string().min(1).max(50),
  phone: z.string().min(10).max(20).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateProfileSchema = z.object({
  first_name: z.string().min(1).max(50).optional(),
  last_name: z.string().min(1).max(50).optional(),
  phone: z.string().max(20).optional(),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8).max(128),
});

const mfaEnableSchema = z.object({});
const mfaVerifySchema = z.object({
  code: z.string().length(6),
});
const mfaDisableSchema = z.object({
  code: z.string().length(6),
});

// POST /api/auth/register - Register new customer
router.post('/register', rateLimit, validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, first_name, last_name, phone } = req.body;
    const db = getDb();

    // Check if user exists
    const existing = qGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'Email already registered' });
    }

    // Create user
    const user = createUser(email, password, first_name, last_name, phone);

    // Create session
    const token = createSession(user);

    // Set cookie
    res.cookie('session_token', token, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      maxAge: config.security.tokenTtl * 1000,
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        is_admin: user.is_admin === 1,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/auth/login - Login
router.post('/login', rateLimit, validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const db = getDb();

    const user = getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
    }

    const userRecord = qGet('SELECT password_hash FROM users WHERE id = ?', [user.id]) as { password_hash: string } | null;
    if (!userRecord || !verifyPassword(password, userRecord.password_hash)) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
    }

    const token = createSession(user);

    res.cookie('session_token', token, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      maxAge: config.security.tokenTtl * 1000,
    });

    const mfaEnabled = user.mfa_verified === 1;
    res.json({
      success: true,
      message: 'Login successful',
      mfa_required: mfaEnabled,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        is_admin: user.is_admin === 1,
        email_verified: user.email_verified === 1,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/auth/logout - Logout
router.post('/logout', authRequired, async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      deleteSession(token);
    }

    res.clearCookie('session_token', {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
    });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', authRequired, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const user = getUserById(session.userId);

    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        is_admin: user.is_admin === 1,
        email_verified: user.email_verified === 1,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/auth/profile - Update profile
router.put('/profile', authRequired, validateBody(updateProfileSchema), async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const updatedUser = updateUserProfile(session.userId, req.body);

    if (!updatedUser) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Profile updated',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        phone: updatedUser.phone,
        is_admin: updatedUser.is_admin === 1,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/auth/change-password - Change password
router.post('/change-password', authRequired, validateBody(changePasswordSchema), async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const { current_password, new_password } = req.body;

    const success = changePassword(session.userId, current_password, new_password);
    if (!success) {
      return res.status(400).json({ error: 'Bad Request', message: 'Current password is incorrect' });
    }

    // Invalidate all sessions for security (optional - keep current session)
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;

// GET /api/auth/mfa/setup - Generate MFA setup data
router.get('/mfa/setup', authRequired, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const user = getUserById(session.userId);
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    if (user.mfa_secret) {
      return res.json({
        success: true,
        already_enabled: true,
        secret: null,
        qr_code_uri: null,
      });
    }

    const secret = generateMFASecret();
    const qr_code_uri = generateMFAQRCodeURI(secret, user.email, user.first_name + ' ' + user.last_name);

    // Store secret temporarily (marked as not verified yet)
    enableMFA(user.id, secret);

    res.json({
      success: true,
      already_enabled: false,
      secret,
      qr_code_uri,
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to generate MFA setup' });
  }
});

// POST /api/auth/mfa/verify - Verify MFA code and enable
router.post('/mfa/verify', authRequired, validateBody(mfaVerifySchema), async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const { code } = req.body;
    const success = verifyAndEnableMFA(session.userId, code);

    if (!success) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid MFA code' });
    }

    res.json({ success: true, message: 'MFA enabled successfully' });
  } catch (error) {
    console.error('MFA verify error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to verify MFA code' });
  }
});

// POST /api/auth/mfa/disable - Disable MFA with verification
router.post('/mfa/disable', authRequired, validateBody(mfaDisableSchema), async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const { code } = req.body;
    const success = disableMFA(session.userId, code);

    if (!success) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid MFA code' });
    }

    res.json({ success: true, message: 'MFA disabled successfully' });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to disable MFA' });
  }
});

// GET /api/auth/mfa/status - Check MFA status
router.get('/mfa/status', authRequired, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const user = getUserById(session.userId);
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    res.json({
      success: true,
      mfa_enabled: user.mfa_verified === 1,
      mfa_pending: user.mfa_secret !== null && user.mfa_verified === 0,
    });
  } catch (error) {
    console.error('MFA status error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get MFA status' });
  }
});

// POST /api/auth/mfa/challenge - Challenge for MFA (during login)
router.post('/mfa/challenge', rateLimit, async (req: Request, res: Response) => {
  try {
    const { email, password, code } = req.body;
    if (!email || !password || !code) {
      return res.status(400).json({ error: 'Bad Request', message: 'Email, password, and MFA code are required' });
    }

    const user = getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    const userRecord = qGet('SELECT password_hash FROM users WHERE id = ?', [user.id]) as { password_hash: string } | null;
    if (!userRecord || !verifyPassword(password, userRecord.password_hash)) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    if (!user.mfa_secret || user.mfa_verified !== 1) {
      return res.json({
        success: true,
        mfa_required: false,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          phone: user.phone,
          is_admin: user.is_admin === 1,
        },
      });
    }

    if (!verifyMFACode(user.mfa_secret, code)) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid MFA code' });
    }

    const token = createSession(user);
    res.cookie('session_token', token, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      maxAge: config.security.tokenTtl * 1000,
    });

    res.json({
      success: true,
      message: 'MFA verification successful',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        is_admin: user.is_admin === 1,
        email_verified: user.email_verified === 1,
      },
    });
  } catch (error) {
    console.error('MFA challenge error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process MFA challenge' });
  }
});

// POST /api/auth/google/callback - Handle Google OAuth callback
router.post('/google/callback', rateLimit, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Bad Request', message: 'Authorization code is required' });
    }

    const response = await fetch('https://dsyjerhfuldpcoshaicl.supabase.co/auth/v1/token?grant_type=authorization_code', {
      method: 'POST',
      headers: {
        'apikey': config.supabase.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    const data = await response.json() as any;
    if (!data.session || !data.session.access_token) {
      return res.status(400).json({ error: 'Bad Request', message: data.error?.message || 'Failed to exchange code' });
    }

    const userResponse = await fetch('https://dsyjerhfuldpcoshaicl.supabase.co/auth/v1/user', {
      headers: {
        'Authorization': `Bearer ${data.session.access_token}`,
        'apikey': config.supabase.anonKey,
      },
    });
    const user = await userResponse.json() as any;

    const existingUser = getUserByEmail(user.email);
    if (existingUser) {
      const metadata = user.user_metadata || {};
      if (!existingUser.first_name || existingUser.first_name === '') {
        const firstName = metadata.first_name || metadata.full_name?.split(' ')[0] || '';
        const lastName = metadata.last_name || metadata.full_name?.split(' ').slice(1).join(' ') || '';
        updateUserProfile(existingUser.id, { first_name: firstName, last_name: lastName });
      }
    } else {
      const firstName = user.user_metadata?.first_name || user.user_metadata?.full_name?.split(' ')[0] || '';
      const lastName = user.user_metadata?.last_name || user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '';
      createUser(user.email, '', firstName, lastName);
    }

    const sessionUser = getUserByEmail(user.email);
    if (!sessionUser) {
      return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create session' });
    }

    const sessionToken = createSession(sessionUser);

    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      maxAge: config.security.tokenTtl * 1000,
    });

    res.json({
      success: true,
      message: 'Google sign-in successful',
      user: {
        id: sessionUser.id,
        email: sessionUser.email,
        first_name: sessionUser.first_name,
        last_name: sessionUser.last_name,
        phone: sessionUser.phone,
        is_admin: sessionUser.is_admin === 1,
        email_verified: sessionUser.email_verified === 1,
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process Google sign-in' });
  }
});


