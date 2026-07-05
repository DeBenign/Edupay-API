// src/middleware/webhook.middleware.js
const crypto   = require('crypto');
const { env }  = require('../config/env');
const { unauthorized } = require('../utils/apiResponse');

const captureRawBody = (req, res, next) => {
  let data = '';
  req.on('data', chunk => { data += chunk; });
  req.on('end', () => {
    req.rawBody = data;
    try { req.body = JSON.parse(data); } catch { req.body = {}; }
    next();
  });
};

const verifyWebhookSignature = (req, res, next) => {
  // In development, skip signature check so you can test manually
  if (env.nodeEnv === 'development') return next();

  const signature = req.headers['x-nomba-signature'];
  if (!signature) {
    console.warn('⚠️  Webhook received without signature');
    return unauthorized(res, 'Missing webhook signature');
  }

  try {
    const expected = crypto
      .createHmac('sha512', env.nomba.webhookSecret)
      .update(req.rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected,  'hex');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      console.warn('⚠️  Webhook signature mismatch');
      return unauthorized(res, 'Invalid webhook signature');
    }
  } catch {
    return unauthorized(res, 'Signature verification failed');
  }

  next();
};

module.exports = { captureRawBody, verifyWebhookSignature };
