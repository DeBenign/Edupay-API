// src/middleware/webhook.middleware.js
const crypto  = require('crypto');
const { env } = require('../config/env');
const { unauthorized } = require('../utils/apiResponse');

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB
// Routes under /api/webhooks that use JWT auth instead of a gateway signature
const JWT_PROTECTED = /^\/(logs|replay\/|debug\/)/i;

// Reads the exact raw bytes (Paystack signs the raw body), then parses JSON
const captureRawBody = (req, res, next) => {
  const chunks = [];
  let size = 0;
  let rejected = false;

  req.on('data', (chunk) => {
    if (rejected) return;
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      rejected = true;
      return res.status(413).json({ success: false, message: 'Payload too large' });
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (rejected) return;
    req.rawBody = Buffer.concat(chunks);
    try { req.body = JSON.parse(req.rawBody.toString('utf8') || '{}'); } catch { req.body = {}; }
    next();
  });
  req.on('error', () => { if (!rejected) { rejected = true; res.status(400).json({ success: false, message: 'Bad request' }); } });
};

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Keep a record of rejected webhooks. Never blocks the response.
const logFailure = async (req, event, reason, signature = null) => {
  try {
    const { WebhookLog } = require('../models/WebhookLog');
    await WebhookLog.create({
      event, payload: req.body || {}, signature, verified: false, processed: false, processingError: reason,
    });
  } catch { /* ignore */ }
};

// Dev-only escape hatch for manual curl testing. Must be switched on explicitly.
const skipVerification = () => process.env.WEBHOOK_SKIP_VERIFY === 'true' && env.nodeEnv !== 'production';

// ─── Nomba: HMAC-SHA256 (base64) over a field string + the nomba-timestamp header ───
const checkNomba = (req) => {
  const secret    = env.nomba.webhookSecret;
  const signature = req.headers['nomba-signature'] || req.headers['nomba-sig-value'];
  const timestamp = req.headers['nomba-timestamp'];

  if (!secret) return { ok: false, event: 'signature_verification_failed', reason: 'NOMBA_WEBHOOK_SECRET is not set' };
  if (!signature || !timestamp) {
    return { ok: false, event: 'signature_verification_failed',
      reason: `Missing nomba-signature or nomba-timestamp. Headers received: ${Object.keys(req.headers).join(', ')}` };
  }

  const body = req.body || {};
  const t = body.data?.transaction || {};
  const m = body.data?.merchant || {};
  const toHash = [
    body.event_type, body.requestId, m.userId, m.walletId,
    t.transactionId, t.type, t.time,
    t.responseCode === 'null' ? '' : t.responseCode, timestamp,
  ].map((v) => v ?? '').join(':');

  const expected = crypto.createHmac('sha256', secret).update(toHash).digest('base64');
  const ok = safeEqual(expected.toLowerCase(), String(signature).toLowerCase()); // Nomba's reference code compares case-insensitively
  if (!ok && env.nodeEnv !== 'production') console.warn('Nomba signature mismatch. String hashed:', toHash);
  return { ok, event: 'signature_mismatch', reason: 'Nomba signature mismatch', signature: String(signature) };
};

// ─── Paystack: HMAC-SHA512 (hex) over the raw body, keyed with your secret key ───
const checkPaystack = (req) => {
  const secret    = env.paystack.webhookSecret;
  const signature = req.headers['x-paystack-signature'];

  if (!secret)    return { ok: false, event: 'signature_verification_failed', reason: 'PAYSTACK_WEBHOOK_SECRET / PAYSTACK_SECRET_KEY is not set' };
  if (!signature) return { ok: false, event: 'signature_verification_failed', reason: 'Missing x-paystack-signature header' };

  const expected = crypto.createHmac('sha512', secret).update(req.rawBody || '').digest('hex');
  return { ok: safeEqual(expected, signature), event: 'signature_mismatch', reason: 'Paystack signature mismatch', signature: String(signature) };
};

// ─── Dispatcher: rejects by default ──────────────────────────────────────────
// Only the JWT-protected admin routes pass through. Any other POST must carry a valid
// gateway signature, so odd URL variants (trailing slash, different case) cannot skip it.
const verifyWebhookSignature = async (req, res, next) => {
  try {
    if (req.method !== 'POST' || JWT_PROTECTED.test(req.path)) return next();

    if (skipVerification()) {
      console.warn('⚠️  WEBHOOK_SKIP_VERIFY is on: signature NOT checked (development only)');
      return next();
    }

    const isPaystack = /^\/paystack\/?$/i.test(req.path);
    const result = isPaystack ? checkPaystack(req) : checkNomba(req);
    if (result.ok) return next();

    console.warn(`⚠️  ${isPaystack ? 'Paystack' : 'Nomba'} webhook rejected: ${result.reason}`);
    await logFailure(req, result.event, result.reason, result.signature || null);
    return unauthorized(res, 'Invalid webhook signature');
  } catch (err) {
    console.error('❌ Webhook signature check crashed:', err.message);
    return unauthorized(res, 'Signature verification failed');
  }
};

module.exports = { captureRawBody, verifyWebhookSignature };