import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import config from './config/app.config.js';
import apiRouter from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { getHealth, getLiveness, getReadiness } from './controllers/health.controller.js';

export const createApp = () => {
  const app = express();

  // Security: Disable Express fingerprinting header
  app.disable('x-powered-by');

  // Reverse Proxy Configuration: Support proxy headers when behind Nginx, ALB, or Docker gateway
  if (process.env.TRUST_PROXY) {
    const trustProxyValue = process.env.TRUST_PROXY === 'true'
      ? 1
      : (isNaN(Number(process.env.TRUST_PROXY)) ? process.env.TRUST_PROXY : Number(process.env.TRUST_PROXY));
    app.set('trust proxy', trustProxyValue);
  } else if (config.env === 'production') {
    app.set('trust proxy', 1);
  }

  // Parse configured frontend origins (supports comma-separated list in production)
  const configuredOrigins = (config.frontendOrigin || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  const allowedOrigins = Array.from(new Set([
    ...configuredOrigins,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174'
  ]));

  // Comprehensive Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", ...allowedOrigins],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'deny' },
      hsts: config.env === 'production' ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      } : false,
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    })
  );

  // Security: Feature / Permissions Policy
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    next();
  });

  // CORS Configuration
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'X-CSRF-Token', 'X-Requested-With', 'Accept', 'Origin', 'Idempotency-Key', 'idempotency-key'],
    credentials: true
  }));

  // Cookie Parsing for Session Management
  app.use(cookieParser());

  // Rate Limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 200 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many requests from this IP, please try again after 15 minutes'
    }
  });
  app.use('/api', limiter);

  // Direct container orchestrator health routes at root
  app.get('/health', getHealth);
  app.get('/health/live', getLiveness);
  app.get('/health/ready', getReadiness);

  // Body Parsing with safe size bounds
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // API Mount
  app.use('/api', apiRouter);

  // 404 Handler
  app.use(notFoundHandler);

  // Central Error Handler
  app.use(errorHandler);

  return app;
};

export default createApp;

