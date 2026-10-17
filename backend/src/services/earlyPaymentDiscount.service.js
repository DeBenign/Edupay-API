// src/services/earlyPaymentDiscount.service.js
const EARLY_PAYMENT_DISCOUNT_RATE = Number(process.env.EARLY_PAYMENT_DISCOUNT_RATE) || 0.10;
const DAY_MS = 24 * 60 * 60 * 1000;

// Single source of truth: is this assignment still inside its early-payment window?
const getEarlyPaymentOffer = (feeAssignment) => {
  const fs = feeAssignment.feeStructureId;
  if (!fs || fs.studentOnly || !fs.dueDate) return null;          // one-off fees never qualify
  if (feeAssignment.totalPaid !== 0) return null;                 // first payment only
  if (Date.now() > new Date(fs.dueDate).getTime() + DAY_MS - 1) return null; // valid through end of due date

  const discountedAmount = Math.round(feeAssignment.amountExpected * (1 - EARLY_PAYMENT_DISCOUNT_RATE));
  return {
    deadline: fs.dueDate,
    discountRate: EARLY_PAYMENT_DISCOUNT_RATE,
    discountedAmount,
    saving: feeAssignment.amountExpected - discountedAmount,
  };
};

const checkEarlyPaymentDiscount = (feeAssignment, amountPaid) => {
  const none = { qualifies: false, discountedThreshold: null, discountAmount: 0 };
  const offer = getEarlyPaymentOffer(feeAssignment);
  if (!offer) return none;

  // Only a payment between the discounted amount and the full fee qualifies
  if (amountPaid < offer.discountedAmount || amountPaid >= feeAssignment.amountExpected)
    return { ...none, discountedThreshold: offer.discountedAmount };

  return {
    qualifies: true,
    discountedThreshold: offer.discountedAmount,
    discountAmount: feeAssignment.amountExpected - amountPaid,
  };
};

module.exports = { checkEarlyPaymentDiscount, getEarlyPaymentOffer, EARLY_PAYMENT_DISCOUNT_RATE };