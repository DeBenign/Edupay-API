// src/utils/hashSignature.js
// Verifies Nomba webhook signatures using HMAC-SHA512.
// This is critical — never process a webhook without verifying first.

const crypto = require('crypto');
const { env } = require('../config/env');

/**
 * Verifies the Nomba webhook signature.
 * Nomba signs the raw request body with HMAC-SHA512 using your webhook secret.
 *
 * @param {Buffer|string} rawBody - The raw request body (must be unparsed bytes)
 * @param {string} signature      - The x-nomba-signature header value
 * @returns {boolean}
 */
const verifyNombaSignature = (rawBody, signature) => {
  if (!signature) return false;

  try {
    const expectedSignature = crypto
      .createHmac('sha512', env.nomba.webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Use timingSafeEqual to prevent timing attacks
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) return false;

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch (err) {
    console.error('❌ Signature verification error:', err.message);
    return false;
  }
};

module.exports = { verifyNombaSignature };
