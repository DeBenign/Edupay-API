// src/models/FeeAssignment.js
const mongoose = require('mongoose');

const feeAssignmentSchema = new mongoose.Schema({
  studentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Student',      required: true },
  schoolId:       { type: mongoose.Schema.Types.ObjectId, ref: 'School',       required: true },
  feeStructureId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeStructure', required: true },
  amountExpected: { type: Number, required: true },
  totalPaid:      { type: Number, default: 0 },
  balance:        { type: Number, default: function() { return this.amountExpected; } },
  overpayment:    { type: Number, default: 0 },
  status:         { type: String, enum: ['unpaid','partial','paid','overpaid'], default: 'unpaid' },
  lastPaymentAt:  { type: Date,   default: null },
  notes:          { type: String, default: null },
  // Task 2iii — set once an early full-payment discount has been applied
  discountApplied: { type: Boolean, default: false },
  discountAmount:  { type: Number, default: 0 },
}, { timestamps: true });

feeAssignmentSchema.index({ studentId: 1, feeStructureId: 1 }, { unique: true });
feeAssignmentSchema.index({ schoolId: 1, status: 1 });

module.exports = mongoose.models.FeeAssignment || mongoose.model('FeeAssignment', feeAssignmentSchema);