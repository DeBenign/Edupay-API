/**
 * scripts/test-paystack-signature.js
 *
 * Verifies, offline, that your PAYSTACK_WEBHOOK_SECRET produces the exact
 * signature Paystack expects — the same class of check that would have
 * caught a Nomba-side config mismatch early instead of chasing "your
 * endpoint is wrong" back and forth with support.
 *
 * Paystack signs webhooks with HMAC-SHA512 of the raw request body, using
 * your SECRET KEY (not a separate webhook secret — Paystack doesn't have
 * a distinct webhook signing secret the way some providers do).
 *
 *   node scripts/test-paystack-signature.js
 */
require('dotenv').config();
const crypto = require('crypto');

const secret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY;
if (!secret) {
  console.error('❌ Set PAYSTACK_SECRET_KEY (or PAYSTACK_WEBHOOK_SECRET) first.');
  process.exit(1);
}

// A realistic charge.success payload shape, close enough to what Paystack
// actually sends for a DVA credit.
const samplePayload = JSON.stringify({
  event: 'charge.success',
  data: {
    reference: 'test_ref_123',
    amount: 500000, // kobo => ₦5,000
    dedicated_account: { account_number: '1234567890' },
    customer: { first_name: 'Pilot', last_name: 'Student' },
  },
});

const expectedSignature = crypto
  .createHmac('sha512', secret)
  .update(samplePayload)
  .digest('hex');

console.log('\nSample payload:', samplePayload);
console.log('\nComputed signature (what your middleware will produce for this exact body):');
console.log(expectedSignature);
console.log(`
To confirm this matches what Paystack actually sends:
  1. Trigger a real test-mode transfer (see test-paystack-pilot.js)
  2. Check your WebhookLog collection (or GET /api/webhooks/logs) for the
     'signature' field on that entry
  3. It won't match this sample signature (different payload/body), but if
     your endpoint logs verified: true for a real event, your secret and
     HMAC logic are correct — if verified: false or signature_mismatch
     shows up, PAYSTACK_SECRET_KEY / PAYSTACK_WEBHOOK_SECRET on Railway
     doesn't match what you copied from the Paystack dashboard.
`);