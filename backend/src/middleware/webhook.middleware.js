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

const verifyWebhookSignature = async (req, res, next) => {
  if (env.nodeEnv === 'development') return next();

  const signature = req.headers['x-nomba-signature'];

  // Log every attempt — success or fail — so we can see what's happening
  const { WebhookLog } = require('../models/WebhookLog');

  if (!signature) {
    console.warn('⚠️  Webhook received without signature. Headers:', JSON.stringify(req.headers));
    await WebhookLog.create({
      event: 'signature_verification_failed',
      payload: req.body,
      signature: null,
      verified: false,
      processed: false,
      processingError: `Missing signature header. Headers received: ${Object.keys(req.headers).join(', ')}`,
    }).catch(() => {});
    return unauthorized(res, 'Missing webhook signature');
  }

  try {
    const expected = crypto
      .createHmac('sha512', env.nomba.webhookSecret)
      .update(req.rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      console.warn('⚠️  Webhook signature mismatch. Expected:', expected, 'Got:', signature);
      await WebhookLog.create({
        event: 'signature_mismatch',
        payload: req.body,
        signature,
        verified: false,
        processed: false,
        processingError: 'Signature mismatch',
      }).catch(() => {});
      return unauthorized(res, 'Invalid webhook signature');
    }
  } catch (err) {
    console.warn('⚠️  Signature verification threw:', err.message);
    return unauthorized(res, 'Signature verification failed');
  }

  next();
};

module.exports = { captureRawBody, verifyWebhookSignature };
