// src/services/platformFee.service.js
//
// Task 1 + Task 4: EduPay's platform fee is set to match what the payment
// gateway itself charges us on a DVA credit — so right now the platform
// fee is a pure pass-through of processing cost, not a separate margin.
// (Future monetization = subscription tiers, per the roadmap note — this
// flat fee is the interim model.)
//
// Confirmed rate for Paystack Dedicated Virtual Accounts: 1% of the
// transaction, capped at ₦300 (paystack.com/pricing — Sept 2023, still
// current as of this integration; re-check before scaling volume, gateway
// pricing can change).
//
// Nomba's DVA fee schedule isn't independently confirmed in this codebase —
// NOMBA_FEE_RATE/NOMBA_FEE_CAP below default to the same numbers as
// Paystack's so nothing under-charges by accident, but confirm the actual
// number with your Nomba account manager and set the env vars once known.

const School = require('../models/School');

const GATEWAY_FEE_CONFIG = {
  paystack: {
    rate: Number(process.env.PAYSTACK_FEE_RATE) || 0.01,   // 1%
    cap:  Number(process.env.PAYSTACK_FEE_CAP)  || 300,    // ₦300
  },
  nomba: {
    rate: Number(process.env.NOMBA_FEE_RATE) || 0.01,      // TODO confirm with Nomba
    cap:  Number(process.env.NOMBA_FEE_CAP)  || 300,       // TODO confirm with Nomba
  },
};

const computeRawFee = (amountPaid, gateway) => {
  const { rate, cap } = GATEWAY_FEE_CONFIG[gateway] || GATEWAY_FEE_CONFIG.paystack;
  return Math.min(amountPaid * rate, cap);
};

// Returns { platformFee, netAmountForSchool, waived }
const resolvePlatformFee = async ({ amountPaid, gateway, schoolId }) => {
  const school = await School.findById(schoolId).select('platformFeeWaivedUntil');
  const waived = !!(school?.platformFeeWaivedUntil && school.platformFeeWaivedUntil > new Date());

  const platformFee = waived ? 0 : Math.round(computeRawFee(amountPaid, gateway));

  return {
    platformFee,
    netAmountForSchool: amountPaid - platformFee,
    waived,
  };
};

module.exports = { resolvePlatformFee, computeRawFee, GATEWAY_FEE_CONFIG };