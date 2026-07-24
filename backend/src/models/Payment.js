// src/models/Payment.js — append-only, never updated after creation
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  studentId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Student',       required: true },
  schoolId:           { type: mongoose.Schema.Types.ObjectId, ref: 'School',        required: true },
  feeAssignmentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'FeeAssignment', required: true },
  amountPaid:         { type: Number, required: true, min: 1 },
  currency:           { type: String, default: 'NGN' },
  reference:          { type: String, required: true },
  narration:          { type: String, default: null },
  payerAccountName:   { type: String, default: null },
  payerAccountNumber: { type: String, default: null },
  payerBankName:      { type: String, default: null },
  reconciliationStatus: { type: String, enum: ['exact','underpayment','overpayment'], required: true },
  balanceBefore:      { type: Number, required: true },
  balanceAfter:       { type: Number, required: true },
  overpaymentAmount:  { type: Number, default: 0 },
  source:             { type: String, enum: ['webhook','sync','manual'], required: true },
  processedAt:        { type: Date, default: Date.now },

  // ── Platform fee (task 1) ────────────────────────────────────────────────
  gateway:             { type: String, enum: ['nomba', 'paystack'], required: true },
  platformFee:         { type: Number, default: 0 }, // what EduPay deducts before crediting school revenue
  platformFeeWaived:   { type: Boolean, default: false }, // true if a referral waiver was active at payment time
  netAmountForSchool:  { type: Number, required: true }, // amountPaid - platformFee — this is what counts as the school's revenue

  // ── Early full-payment discount (task 2iii) ──────────────────────────────
  earlyPaymentDiscountApplied: { type: Boolean, default: false },
  earlyPaymentDiscountAmount:  { type: Number, default: 0 }, // absorbed by the school, not the platform
}, { timestamps: true });

paymentSchema.index({ studentId: 1, createdAt: -1 });
paymentSchema.index({ schoolId:  1, createdAt: -1 });
paymentSchema.index({ reference: 1 }, { unique: true });

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);