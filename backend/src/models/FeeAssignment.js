// src/models/FeeAssignment.js
// The live record of what a student owes and has paid for a specific term.
// This is the primary record updated by the reconciliation engine.

const mongoose = require('mongoose');

const feeAssignmentSchema = new mongoose.Schema(
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
    feeStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeStructure',
      required: true,
    },

    // ─── Financial State ──────────────────────────────────────────────────────
    amountExpected: {
      type: Number,
      required: true,
    },
    totalPaid: {
      type: Number,
      default: 0,
    },
    balance: {
      type: Number,
      default: function () {
        return this.amountExpected;
      },
    },
    overpayment: {
      type: Number,
      default: 0,
    },

    // ─── Status ───────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid', 'overpaid'],
      default: 'unpaid',
    },

    lastPaymentAt: {
      type: Date,
      default: null,
    },

    // Bursar notes e.g. for manual overrides or flagged cases
    notes: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// ─── One assignment per student per fee structure ─────────────────────────────
feeAssignmentSchema.index(
  { studentId: 1, feeStructureId: 1 },
  { unique: true }
);

// ─── Fast lookups by school + status (for reports) ───────────────────────────
feeAssignmentSchema.index({ schoolId: 1, status: 1 });

module.exports = mongoose.model('FeeAssignment', feeAssignmentSchema);
