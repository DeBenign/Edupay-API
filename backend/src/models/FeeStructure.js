// src/models/FeeStructure.js
const mongoose = require('mongoose');

const feeStructureSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Fee structure name is required'],
      trim: true,
      // e.g. "First Term Fees 2024/2025 - JSS 1"
    },
    class: {
      type: String,
      required: [true, 'Class is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Fee amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    academicSession: {
      type: String,
      required: true,
      trim: true,
      // e.g. "2024/2025"
    },
    term: {
      type: String,
      enum: ['first', 'second', 'third'],
      required: true,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// ─── Prevent duplicate fee structures for same class/term/session ─────────────
feeStructureSchema.index(
  { schoolId: 1, class: 1, term: 1, academicSession: 1 },
  { unique: true }
);

module.exports = mongoose.model('FeeStructure', feeStructureSchema);
