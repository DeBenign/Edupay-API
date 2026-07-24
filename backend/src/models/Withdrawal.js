// src/models/Withdrawal.js
// Task 3: how platform revenue and each school's revenue gets withdrawn to
// a real bank account. schoolId is null for a platform-level withdrawal
// (initiated by platform ops), set for a school withdrawing its own revenue
// (initiated by that school's admin/bursar).
const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  type:     { type: String, enum: ['platform', 'school'], required: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null },

  amount:         { type: Number, required: true, min: 1 },
  accountNumber:  { type: String, required: true },
  bankCode:       { type: String, required: true },
  accountName:    { type: String, required: true },

  gateway:  { type: String, enum: ['paystack', 'nomba'], required: true }, // which transfer API moves the money out
  status:   { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  reference:      { type: String, required: true, unique: true },
  gatewayResponse: { type: mongoose.Schema.Types.Mixed, default: null },
  failureReason:  { type: String, default: null },

  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  processedAt: { type: Date, default: null },
}, { timestamps: true });

withdrawalSchema.index({ schoolId: 1, createdAt: -1 });
withdrawalSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.models.Withdrawal || mongoose.model('Withdrawal', withdrawalSchema);