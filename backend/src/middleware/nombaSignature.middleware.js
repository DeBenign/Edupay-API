// src/middleware/nombaSignature.middleware.js
const crypto = require('crypto');
const { env } = require('../config/env');

const verifyNombaSignature = (req, res, next) => {
  const secret    = env.nomba.webhookSecret;
  const signature = req.headers['nomba-signature'] || req.headers['nomba-sig-value'];
  const timestamp = req.headers['nomba-timestamp'];
  if (!secret || !signature || !timestamp) return res.status(401).json({ error: 'Missing webhook signature' });

  const body = req.body || {};
  const t = body.data?.transaction || {};
  const m = body.data?.merchant || {};
  const toHash = [
    body.event_type, body.requestId, m.userId, m.walletId,
    t.transactionId, t.type, t.time, t.responseCode === 'null' ? '' : t.responseCode, timestamp,
  ].map((v) => v ?? '').join(':');

  const expected = crypto.createHmac('sha256', secret).update(toHash).digest('base64').toLowerCase();
  const got = String(signature).toLowerCase(); // Nomba's reference code compares case-insensitively
  const ok = expected.length === got.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));

  if (!ok) {
    if (process.env.NODE_ENV !== 'production') console.warn('Nomba signature mismatch. String hashed:', toHash);
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }
  next();
};

module.exports = { verifyNombaSignature };