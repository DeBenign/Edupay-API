// src/models/Payment.js
// Immutable payment log. Records are NEVER updated after creation.
// Every inbound transfer from Nomba produces exactly one Payment document.

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    feeAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeAssignment',
      required: true,
    },

    // ─── Payment Details (from Nomba) ─────────────────────────────────────────
    amountPaid: {
      type: Number,
      required: true,
      min: [1, 'Amount must be greater than 0'],
    },
    currency: {
      type: String,
      default: 'NGN',
    },
    // Nomba transaction reference — used as idempotency key
    // Note: uniqueness enforced via schema.index() below, not inline unique:true
    reference: {
      type: String,
      required: true,
    },
    narration: {
      type: String,
      default: null,
    },
    payerAccountName: {
      type: String,
      default: null,
    },
    payerAccountNumber: {
      type: String,
      default: null,
    },
    payerBankName: {
      type: String,
      default: null,
    },

    // ─── Reconciliation Outcome ───────────────────────────────────────────────
    reconciliationStatus: {
      type: String,
      enum: ['exact', 'underpayment', 'overpayment'],
      required: true,
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    overpaymentAmount: {
      type: Number,
      default: 0,
    },

    // ─── Source of Record ─────────────────────────────────────────────────────
    source: {
      type: String,
      enum: ['webhook', 'sync', 'manual'],
      required: true,
    },

    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    // Make this collection append-only at the schema level
    // (enforcement is in the service layer too)
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
paymentSchema.index({ studentId: 1, createdAt: -1 });
paymentSchema.index({ schoolId: 1, createdAt: -1 });
paymentSchema.index({ reference: 1 }, { unique: true });

module.exports = mongoose.model('Payment', paymentSchema);
