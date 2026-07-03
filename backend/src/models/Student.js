// src/models/Student.js
const mongoose = require('mongoose');

const virtualAccountSchema = new mongoose.Schema(
  {
    accountNumber: { type: String, default: null },
    accountName:   { type: String, default: null },
    bankName:      { type: String, default: null },
    bankCode:      { type: String, default: null },
    nombaReference:{ type: String, default: null },
    provisionedAt: { type: Date,   default: null },
  },
  { _id: false }
);

const studentSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,    // Can be linked later when parent registers
    },
    fullName: {
      type: String,
      required: [true, 'Student full name is required'],
      trim: true,
    },
    studentId: {
      type: String,
      required: [true, 'Student ID is required'],
      trim: true,
    },
    class: {
      type: String,
      required: [true, 'Class is required'],
      trim: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female'],
      required: true,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },

    // Assigned when student is enrolled
    virtualAccount: {
      type: virtualAccountSchema,
      default: () => ({}),
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// ─── Compound index: studentId must be unique per school ──────────────────────
studentSchema.index({ schoolId: 1, studentId: 1 }, { unique: true });

// ─── Index for fast lookup by virtual account number (used in webhooks) ────────
studentSchema.index({ 'virtualAccount.accountNumber': 1 });

module.exports = mongoose.model('Student', studentSchema);
