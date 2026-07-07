// src/app.js
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const { env }    = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { captureRawBody, verifyWebhookSignature } = require('./middleware/webhook.middleware');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE'] }));
app.use(rateLimit({ windowMs: 15*60*1000, max: 200, standardHeaders: true, legacyHeaders: false }));

if (env.nodeEnv === 'development') app.use(morgan('dev'));
else                               app.use(morgan('combined'));

// ── Root route ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({
  success: true, name: 'EduPay API', version: '1.0.0',
  status: 'running', health: '/health', api: '/api',
}));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  success: true, message: 'EduPay API is running',
  environment: env.nodeEnv, timestamp: new Date().toISOString(),
}));

// ── Webhook (raw body BEFORE json parser) ────────────────────────────────────
app.use('/api/webhooks', captureRawBody, verifyWebhookSignature, require('./routes/webhook.routes'));

// ── Body parser ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth.routes'));
app.use('/api/schools',       require('./routes/school.routes'));
app.use('/api/students',      require('./routes/student.routes'));
app.use('/api/fees',          require('./routes/fee.routes'));
app.use('/api/payments',      require('./routes/payment.routes'));
app.use('/api/reports',       require('./routes/report.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/parents',       require('./routes/parent.routes'));

// ── Error handlers ────────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
