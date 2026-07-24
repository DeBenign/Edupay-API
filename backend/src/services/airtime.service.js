// src/services/airtime.service.js
//
// Task 2ii: ₦2,000 airtime credit for a user who refers a school.
//
// IMPORTANT: Paystack does not offer a Nigerian airtime/VTU API — this is
// intentionally built as a small abstraction so you can plug in whichever
// VTU provider you choose (common options: VTpass, Reloadly, Flutterwave
// Bills). The shape below matches VTpass's typical request format as a
// starting point since it's widely used in Nigeria — swap the endpoint/
// payload in `callProvider` once you've picked and signed up with one.
//
// Nothing else in the codebase needs to change when you swap providers —
// referral.service.js only calls topUpAirtime(), never the HTTP details.

const axios = require('axios');
const { env } = require('../config/env');

const callProvider = async ({ phone, amount, network }) => {
  if (!env.airtime?.apiKey || !env.airtime?.baseUrl) {
    throw new Error('Airtime provider not configured — set AIRTIME_PROVIDER_BASE_URL and AIRTIME_PROVIDER_API_KEY');
  }

  // Example shape (VTpass-style) — adjust field names to match your chosen provider's docs.
  const response = await axios.post(
    `${env.airtime.baseUrl}/pay`,
    {
      request_id: `edupay-referral-${Date.now()}`,
      serviceID: network || 'mtn', // provider needs to know which network to top up
      amount,
      phone,
    },
    { headers: { Authorization: `Bearer ${env.airtime.apiKey}` }, timeout: 15000 }
  );

  return response.data;
};

// Returns { success, reference, raw }
const topUpAirtime = async ({ phone, amount = 2000, network = 'mtn' }) => {
  if (!phone) throw new Error('Phone number is required for airtime top-up');
  try {
    const result = await callProvider({ phone, amount, network });
    return { success: true, reference: result.requestId || result.reference || null, raw: result };
  } catch (err) {
    console.error('❌ Airtime top-up failed:', err.response?.data || err.message);
    return { success: false, reference: null, raw: err.response?.data || err.message };
  }
};

module.exports = { topUpAirtime };