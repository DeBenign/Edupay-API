const mongoose = require("mongoose");

const ReferralRewardSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  ownerType: { type: String, enum: ["admin", "bursar", "parent"], required: true },
  amount: { type: Number, default: 2000 },
  status: { type: String, enum: ["unclaimed", "processing", "claimed", "failed"], default: "unclaimed" },
  phoneNumber: String,
  network: String,
  vtpassRequestId: String,
  claimedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model("ReferralReward", ReferralRewardSchema);