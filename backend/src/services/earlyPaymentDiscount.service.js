// src/services/earlyPaymentDiscount.service.js
//
// Task 2iii: 10% discount for a parent who pays the FULL fee before the
// due date, in one transaction. The school bears this discount, not the
// platform — this is enforced automatically by construction, because
// platformFee.service.js always computes its cut on the actual amountPaid,
// never on the undiscounted amountExpected. The 10% the school "loses" here
// never touches the platform fee calculation.

const EARLY_PAYMENT_DISCOUNT_RATE = Number(process.env.EARLY_PAYMENT_DISCOUNT_RATE) || 0.10;

/**
 * @param feeAssignment  the open FeeAssignment (with feeStructureId populated for dueDate)
 * @param amountPaid     this transaction's amount
 * @returns { qualifies, discountedThreshold, discountAmount }
 */
const checkEarlyPaymentDiscount = (feeAssignment, amountPaid) => {
  const dueDate = feeAssignment.feeStructureId?.dueDate;
  const isFirstPayment = feeAssignment.totalPaid === 0;
  const beforeDueDate  = dueDate && new Date() <= new Date(dueDate);

  if (!isFirstPayment || !beforeDueDate) {
    return { qualifies: false, discountedThreshold: null, discountAmount: 0 };
  }

  // "Full payment" at the discounted rate — e.g. ₦90,000 counts as full
  // settlement of a ₦100,000 fee if paid whole, before the due date.
  const discountedThreshold = Math.round(feeAssignment.amountExpected * (1 - EARLY_PAYMENT_DISCOUNT_RATE));

  if (amountPaid < discountedThreshold) {
    return { qualifies: false, discountedThreshold, discountAmount: 0 };
  }

  return {
    qualifies: true,
    discountedThreshold,
    discountAmount: feeAssignment.amountExpected - amountPaid, // what the school is forgoing
  };
};

module.exports = { checkEarlyPaymentDiscount, EARLY_PAYMENT_DISCOUNT_RATE };