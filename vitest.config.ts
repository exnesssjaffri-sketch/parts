import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['backend/test/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      JWT_SECRET: 'test-jwt-secret-for-development-only-do-not-use-in-production-at-least-32-chars',
      SESSION_SECRET: 'test-session-secret-for-development-only-do-not-use-in-production-32chars',
      NODE_ENV: 'test',
      SUPABASE_URL: 'https://dsyjerhfuldpcoshaicl.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key-placeholder',
    },
  },
  resolve: {
    alias: {
      '@backend': join(__dirname, 'backend/src'),
    },
  },
})
