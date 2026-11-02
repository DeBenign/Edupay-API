// src/controllers/pricing.controller.js
// Public, read-only pricing numbers for the website. Everything here comes from the same
// constants the billing and service-charge code use, so the Pricing page can never disagree
// with what schools are actually charged. Change a price in env and the page follows.
const { success, error } = require('../utils/apiResponse');
const { TERM_DAYS, RATE, MINIMUM, graceDays } = require('../services/subscriptionAccess.service');
const { computeAmountToCollect, GATEWAY_FEE_CONFIG } = require('../services/platformFee.service');

const EXAMPLE_STUDENTS = [50, 100, 300, 500, 1000];
const EXAMPLE_FEES = [1000, 10000, 100000];

// WhatsApp wants digits only, in international format (e.g. 2348158447480)
const digits = (v) => (v || '').replace(/\D/g, '') || null;

const getPricing = (req, res) => {
  try {
    const cfg = GATEWAY_FEE_CONFIG.paystack;

    const subscription = {
      ratePerStudent: RATE,
      minimum: MINIMUM,
      termDays: TERM_DAYS,          // also the length of the free pilot
      graceDays: graceDays(),
      examples: EXAMPLE_STUDENTS.map((students) => ({ students, perTerm: Math.max(MINIMUM, students * RATE) })),
    };

    const serviceCharge = {
      rate: cfg.rate,
      flat: cfg.flatFee,
      cap: cfg.cap,
      flatWaivedAtOrBelow: cfg.waiveFlatFeeBelow,
      examples: EXAMPLE_FEES.map((fee) => {
        const { platformFee, totalAmountToPay } = computeAmountToCollect(fee, 'paystack');
        return { schoolFee: fee, parentPays: totalAmountToPay, charge: platformFee, schoolReceives: fee };
      }),
    };

    res.set('Cache-Control', 'public, max-age=300');
    return success(res, {
      subscription,
      serviceCharge,
      // Placeholder switch: flip SUBSCRIPTION_ONLINE_PAYMENTS=true when online subscription payment exists.
      onlineSubscriptionPayments: String(process.env.SUBSCRIPTION_ONLINE_PAYMENTS).toLowerCase() === 'true',
      contact: {
        whatsapp: digits(process.env.CONTACT_WHATSAPP),
        phone: process.env.CONTACT_PHONE || null,
        email: process.env.CONTACT_EMAIL || null,
      },
    });
  } catch { return error(res); }
};

module.exports = { getPricing };
