// src/services/platformFee.service.js
const School = require('../models/School');

const GATEWAY_FEE_CONFIG = {
  paystack: {
    rate:    Number(process.env.PAYSTACK_FEE_RATE) || 0.015,
    flatFee: Number(process.env.PAYSTACK_FEE_FLAT) || 100,
    cap:     Number(process.env.PAYSTACK_FEE_CAP)  || 2000,
    waiveFlatFeeBelow: 2500,
  },
  nomba: {
    rate:    Number(process.env.NOMBA_FEE_RATE) || 0.015,
    flatFee: Number(process.env.NOMBA_FEE_FLAT) || 100,
    cap:     Number(process.env.NOMBA_FEE_CAP)  || 2000,
    waiveFlatFeeBelow: 2500,
  },
};

const computeRawFee = (amount, gateway) => {
  const cfg  = GATEWAY_FEE_CONFIG[gateway] || GATEWAY_FEE_CONFIG.paystack;
  const flat = amount <= cfg.waiveFlatFeeBelow ? 0 : cfg.flatFee;
  return Math.min((amount * cfg.rate) + flat, cfg.cap);
};

const isFeeWaived = async (schoolId) => {
  const school = await School.findById(schoolId).select('platformFeeWaivedUntil');
  return !!(school?.platformFeeWaivedUntil && school.platformFeeWaivedUntil > new Date());
};

// Display helper: the amount a parent should transfer so the school nets
// exactly `balance` AFTER the fee is taken from what actually arrives.
const computeAmountToCollect = (balance, gateway, { waived = false } = {}) => {
  if (waived || balance <= 0) {
    return { baseAmount: balance, platformFee: 0, totalAmountToPay: balance };
  }
  let total = Math.ceil(balance + computeRawFee(balance, gateway));
  // The fee is charged on the total that arrives (same rounding as resolvePlatformFee),
  // so nudge up until the school nets the full balance.
  for (let i = 0; i < 1000 && total - Math.round(computeRawFee(total, gateway)) < balance; i++) total += 1;
  return { baseAmount: balance, platformFee: total - balance, totalAmountToPay: total };
};

// Applied to whatever actually arrives.
const resolvePlatformFee = async ({ amountPaid, gateway, schoolId }) => {
  const waived = await isFeeWaived(schoolId);
  const platformFee = waived ? 0 : Math.round(computeRawFee(amountPaid, gateway));
  return { platformFee, netAmountForSchool: amountPaid - platformFee, waived };
};

module.exports = { resolvePlatformFee, computeRawFee, computeAmountToCollect, isFeeWaived, GATEWAY_FEE_CONFIG };