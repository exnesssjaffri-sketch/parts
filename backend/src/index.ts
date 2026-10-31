import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { ensureDb, initDatabase, seedIfEmpty } from './db/index.js';
import { corsHeaders, securityHeaders, rateLimit, errorHandler } from './middleware/index.js';
import { auditMiddleware } from './utils/audit.js';
import productRoutes from './routes/products.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';

const app = express();

// Trust proxy for accurate IP detection
app.set('trust proxy', 1);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser(config.security.sessionSecret));

// Security and CORS
app.use(securityHeaders);
app.use(corsHeaders);

// Audit logging
app.use(auditMiddleware());

// Rate limiting (applied globally)
app.use(rateLimit);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.env,
  });
});

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler for API routes
app.use(/^\/api/, (req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'API endpoint not found' });
});

// Global error handler
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    console.log('Initializing database...');
    await ensureDb();
    initDatabase();

    // Seed if empty (run in background)
    setTimeout(() => seedIfEmpty(), 100);

    const server = app.listen(config.server.port, config.server.host, () => {
      console.log(`Automarts API server running on http://${config.server.host}:${config.server.port}`);
      console.log(`   Environment: ${config.env}`);
      console.log(`   Database: ${config.db.path}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only start the HTTP server when this file is the process entry point.
// When imported (e.g. by the test suite) the Express app is exported without
// binding a listening socket, so tests can mount it on an ephemeral port.
const isMainModule = process.argv[1] &&
  (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'));
if (isMainModule) {
  startServer();
}

export { app };
