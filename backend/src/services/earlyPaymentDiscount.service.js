// src/services/earlyPaymentDiscount.service.js
const EARLY_PAYMENT_DISCOUNT_RATE = Number(process.env.EARLY_PAYMENT_DISCOUNT_RATE) || 0.10;
const DAY_MS = 24 * 60 * 60 * 1000;

const checkEarlyPaymentDiscount = (feeAssignment, amountPaid) => {
  const none = { qualifies: false, discountedThreshold: null, discountAmount: 0 };
  const fs = feeAssignment.feeStructureId;

  // One-off fees and fees without a due date never get the discount
  if (!fs || fs.studentOnly || !fs.dueDate) return none;
  if (feeAssignment.totalPaid !== 0) return none;
  if (Date.now() > new Date(fs.dueDate).getTime() + DAY_MS - 1) return none; // valid through end of due date

  const discountedThreshold = Math.round(feeAssignment.amountExpected * (1 - EARLY_PAYMENT_DISCOUNT_RATE));

  // Only a payment between the discounted amount and the full fee qualifies.
  // Full payment or more needs no discount; normal exact/overpayment handling applies.
  if (amountPaid < discountedThreshold || amountPaid >= feeAssignment.amountExpected)
    return { ...none, discountedThreshold };

  return { qualifies: true, discountedThreshold, discountAmount: feeAssignment.amountExpected - amountPaid };
};

module.exports = { checkEarlyPaymentDiscount, EARLY_PAYMENT_DISCOUNT_RATE };