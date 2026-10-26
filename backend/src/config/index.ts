import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file if present
function loadEnv(): void {
  let envPath = join(__dirname, '..', '..', '..', '.env');
  if (!existsSync(envPath)) {
    const altEnvPath = join(__dirname, '..', '..', '.env');
    if (existsSync(altEnvPath)) {
      process.env.__ENV_PATH = altEnvPath;
      envPath = altEnvPath;
    }
  }
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

loadEnv();

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value !== undefined) return value;
  if (defaultValue !== undefined) return defaultValue;
  if (process.env.NODE_ENV === 'test') return '';
  throw new Error(`Missing required environment variable: ${key}`);
}

function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value !== undefined) {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) throw new Error(`Invalid integer for ${key}: ${value}`);
    return parsed;
  }
  return defaultValue;
}

function _getEnvBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value !== undefined) {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return defaultValue;
}

export const config = {
  env: getEnv('NODE_ENV', 'development'),

  server: {
    port: getEnvInt('PORT', 8000),
    host: getEnv('HOST', '0.0.0.0'),
  },

  db: {
    path: getEnv('DB_PATH', join(__dirname, '..', '..', 'automarts.db')),
  },

  security: {
    jwtSecret: getEnv('JWT_SECRET'),
    sessionSecret: getEnv('SESSION_SECRET'),
    tokenTtl: getEnvInt('TOKEN_TTL', 604800),
  },

  rateLimit: {
    windowMs: getEnvInt('RATE_LIMIT_WINDOW', 60) * 1000,
    maxRequests: getEnvInt('RATE_LIMIT_MAX', 120),
  },

  cors: {
    allowedOrigins: getEnv('ALLOWED_ORIGINS', 'http://localhost:3000').split(',').map(o => o.trim()).filter(Boolean),
  },

  delivery: {
    chargePkR: getEnvInt('DELIVERY_CHARGE_PKR', 250),
    freeThresholdPkR: getEnvInt('FREE_DELIVERY_THRESHOLD_PKR', 5000),
    currency: 'PKR',
  },

  admin: {
    email: getEnv('ADMIN_EMAIL', 'admin@automarts.pk'),
    password: getEnv('ADMIN_PASSWORD', ''),
  },

  payment: {
    provider: getEnv('PAYMENT_PROVIDER', 'cod').toLowerCase(),
    stripeSecretKey: getEnv('STRIPE_SECRET_KEY', ''),
    razorpayKeyId: getEnv('RAZORPAY_KEY_ID', ''),
    razorpayKeySecret: getEnv('RAZORPAY_KEY_SECRET', ''),
  },

  supabase: {
    url: getEnv('SUPABASE_URL', ''),
    anonKey: getEnv('SUPABASE_ANON_KEY', ''),
  },
};

export const isProduction = config.env === 'production';
export const isDevelopment = config.env === 'development';

// Validate critical config on startup
if (isProduction) {
  if (config.security.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  if (config.admin.password === 'changeme123' || config.admin.password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be secure in production');
  }
  if (config.security.sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters in production');
  }
}