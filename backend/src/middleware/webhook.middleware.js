// src/middleware/webhook.middleware.js
// IMPORTANT: This middleware must run BEFORE express.json() for the webhook route.
// It captures the raw body buffer needed for HMAC signature verification.

const { verifyNombaSignature } = require('../utils/hashSignature');
const { unauthorized } = require('../utils/apiResponse');

/**
 * Captures the raw request body as a Buffer.
 * Must be registered with express.raw() for the webhook route.
 */
const captureRawBody = (req, res, next) => {
  let data = '';
  req.on('data', (chunk) => { data += chunk; });
  req.on('end', () => {
    req.rawBody = data;
    try {
      req.body = JSON.parse(data);
    } catch {
      req.body = {};
    }
    next();
  });
};

/**
 * Verifies the Nomba webhook HMAC signature.
 * Rejects any request that doesn't pass verification.
 */
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-nomba-signature'];

  if (!signature) {
    console.warn('⚠️  Webhook received without signature header');
    return unauthorized(res, 'Missing webhook signature');
  }

  const isValid = verifyNombaSignature(req.rawBody, signature);

  if (!isValid) {
    console.warn('⚠️  Webhook signature verification failed');
    return unauthorized(res, 'Invalid webhook signature');
  }

  next();
};

module.exports = { captureRawBody, verifyWebhookSignature };
