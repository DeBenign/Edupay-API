// src/models/Referral.js
// One record per successful referral signup. Rewards are applied MANUALLY
// by an admin (see referral.controller.js) — this just tracks the trail so
// nothing gets paid out twice and there's an audit log of who got what.
const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true },

  // Exactly one of these two will be set, depending on whether a school's
  // own referralCode or an individual user's personal referralCode was used.
  referrerSchoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null },
  referrerUserId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',   default: null },

  referredSchoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },

  // Task 2i — referrer school gets 1 month of platformFee waived
  feeWaiverStatus:    { type: String, enum: ['none', 'pending', 'applied'], default: 'none' },
  feeWaiverAppliedAt: { type: Date, default: null },

  // Task 2ii — referring user (admin/bursar/parent) gets ₦2,000 airtime
  airtimeStatus:    { type: String, enum: ['none', 'pending', 'sent', 'failed'], default: 'none' },
  airtimeAmount:    { type: Number, default: 2000 },
  airtimeSentAt:    { type: Date, default: null },
  airtimeReference: { type: String, default: null },

  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // admin who triggered the reward
}, { timestamps: true });

referralSchema.index({ referredSchoolId: 1 }, { unique: true }); // a school can only be "the referred one" once

module.exports = mongoose.models.Referral || mongoose.model('Referral', referralSchema);