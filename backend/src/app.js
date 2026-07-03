// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { env } = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { captureRawBody, verifyWebhookSignature } = require('./middleware/webhook.middleware');

// ─── Import Routes ─────────────────────────────────────────────────────────
const authRoutes         = require('./routes/auth.routes');
const schoolRoutes       = require('./routes/school.routes');
const studentRoutes      = require('./routes/student.routes');
const feeRoutes          = require('./routes/fee.routes');
const paymentRoutes      = require('./routes/payment.routes');
const webhookRoutes      = require('./routes/webhook.routes');
const reportRoutes       = require('./routes/report.routes');
const notificationRoutes = require('./routes/notification.routes');
const parentRoutes       = require('./routes/parent.routes');

const app = express();

// ─── Security Headers ──────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ──────────────────────────────────────────────────────────────────
app.use(cors({
  origin: env.clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Rate Limiting ─────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

app.use(generalLimiter);

// ─── Logger ────────────────────────────────────────────────────────────────
if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ─── WEBHOOK ROUTE (raw body BEFORE json parser) ──────────────────────────
// Must be registered before express.json() so we can capture raw bytes
// for HMAC verification
app.use('/api/webhooks', captureRawBody, verifyWebhookSignature, webhookRoutes);

// ─── Body Parser ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── Health Check ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'School Fee Tracker API is running',
    environment: env.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ────────────────────────────────────────────────────────────
app.use('/api/auth',          authLimiter,    authRoutes);
app.use('/api/schools',                       schoolRoutes);
app.use('/api/students',                      studentRoutes);
app.use('/api/fees',                          feeRoutes);
app.use('/api/payments',                      paymentRoutes);
app.use('/api/reports',                       reportRoutes);
app.use('/api/notifications',                 notificationRoutes);
app.use('/api/parents',                       parentRoutes);

// ─── 404 + Error Handlers ──────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
