/**
 * scripts/test-paystack-pilot.js
 *
 * Run this yourself (Railway shell, or locally with a .env file) —
 * it needs your real PAYSTACK_SECRET_KEY and outbound network access,
 * which I don't have from this sandbox.
 *
 *   node scripts/test-paystack-pilot.js
 *
 * What it does, in order:
 *   1. Lists available DVA providers (confirms your secret key + account work at all)
 *   2. Creates a test customer
 *   3. Creates a Dedicated Virtual Account using 'test-bank' (test-mode only —
 *      no real bank account is involved, no real money at risk)
 *   4. Prints the account number and tells you how to send a test transfer
 *      to it using Paystack's demo bank app
 *
 * Requires PAYSTACK_SECRET_KEY to be a TEST key (starts with sk_test_).
 * Do NOT run this against a live secret key with preferredBank='test-bank' —
 * it will fail, since test-bank only exists in test mode.
 */
require('dotenv').config();
const axios = require('axios');

const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
if (!SECRET_KEY) {
  console.error('❌ Set PAYSTACK_SECRET_KEY (a sk_test_... key) before running this.');
  process.exit(1);
}
if (!SECRET_KEY.startsWith('sk_test_')) {
  console.warn('⚠️  This key does not look like a test key (sk_test_...). Proceeding anyway, but double-check you are not about to touch live data.');
}

const client = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: { Authorization: `Bearer ${SECRET_KEY}`, 'Content-Type': 'application/json' },
});

const run = async () => {
  console.log('\n1) Fetching available DVA providers...');
  const providers = await client.get('/dedicated_account/available_providers');
  console.log(JSON.stringify(providers.data.data, null, 2));

  console.log('\n2) Creating a test customer...');
  const customerRes = await client.post('/customer', {
    email: `pilot.student.${Date.now()}@edupay.test`,
    first_name: 'Pilot',
    last_name: 'Student',
    phone: '08010000000',
  });
  const customer = customerRes.data.data;
  console.log(`   Customer created: ${customer.customer_code}`);

  console.log('\n3) Creating a Dedicated Virtual Account (test-bank)...');
  const dvaRes = await client.post('/dedicated_account', {
    customer: customer.customer_code,
    preferred_bank: 'test-bank',
  });
  const dva = dvaRes.data.data;
  console.log(`   Account created: ${dva.account_number} — ${dva.account_name} (${dva.bank?.name})`);

  console.log(`
✅ Done. Next steps:
   1. Go to https://demobank.paystackintegrations.com/
   2. Use test account 123 000 164 4 (pin 0000) to send a transfer of any
      amount to account number ${dva.account_number}
   3. Watch your Railway logs / GET /api/webhooks/logs for a charge.success
      event to arrive within a few seconds
   4. Confirm the matching student's balance drops in your dashboard

If step 3 never happens: the problem is webhook delivery on Paystack's
side or your webhook URL registration — not your reconciliation code,
since that only runs after the webhook (or a manual verify) fires.
`);
};

run().catch(err => {
  console.error('❌ Test failed:', err.response?.data || err.message);
  process.exit(1);
});