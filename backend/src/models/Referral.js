// src/models/Referral.js
// One record per successful referral signup. Rewards convert automatically
// on the referred school's first payment (see referral.service.js's
// checkReferralConversion) — this tracks the trail so nothing gets granted
// twice and there's an audit log of who got what.
const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true },

  // Exactly one of these two will be set, depending on whether a school's
  // own referralCode or an individual user's personal referralCode was used.
  referrerSchoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null },
  referrerUserId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',   default: null },
  referrerRole:     { type: String, enum: ['admin', 'bursar', 'parent'], default: null },

  referredSchoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },

  // Task 2i — referrer school gets 1 month of platformFee waived
  feeWaiverStatus: { type: String, enum: ['none', 'pending', 'applied', 'blocked'], default: 'none' },
  feeWaiverAppliedAt: { type: Date, default: null },

  // Task 2ii — referring user (admin/bursar/parent) becomes eligible for
  // ₦1,000 airtime. 'reward_created' means a claimable ReferralReward now
  // exists — whether the user has actually claimed it lives on that document
  // (unclaimed/processing/claimed/failed), not here.
  airtimeStatus:   { type: String, enum: ['none', 'pending', 'reward_created', 'failed', 'blocked'], default: 'none' },
  airtimeAmount: { type: Number, default: 1000 },

  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // admin who manually triggered a fee-waiver override, if any
}, { timestamps: true });

referralSchema.index({ referredSchoolId: 1 }, { unique: true }); // a school can only be "the referred one" once

module.exports = mongoose.models.Referral || mongoose.model('Referral', referralSchema);