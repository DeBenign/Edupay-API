// src/models/ReferralReward.js
const mongoose = require('mongoose');

const ReferralRewardSchema = new mongoose.Schema({
  ownerId:    { type: mongoose.Schema.Types.ObjectId, required: true },
  ownerType:  { type: String, enum: ['admin', 'bursar', 'parent'], required: true },
  referralId: { type: mongoose.Schema.Types.ObjectId, ref: 'Referral' },
  amount:     { type: Number, default: 1000 },
  status:     { type: String, enum: ['unclaimed', 'processing', 'claimed', 'failed'], default: 'unclaimed' },

  // Chosen by the owner when claiming
  rewardType:    { type: String, enum: ['airtime', 'data'], default: 'airtime' },
  phoneNumber:   String,
  network:       String,
  variationCode: { type: String, default: null }, // data plan code
  planName:      { type: String, default: null },

  // Provider tracking. Every attempt gets its own request id, so a retry can never double-buy.
  attempts:        { type: Number, default: 0 },
  vtpassRequestId: String,
  claimedAt:       Date,
}, { timestamps: true });

ReferralRewardSchema.index({ ownerId: 1, createdAt: -1 });
// One referral can only ever produce one reward
ReferralRewardSchema.index({ referralId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.ReferralReward || mongoose.model('ReferralReward', ReferralRewardSchema);