// src/controllers/referral.controller.js
const Referral = require('../models/Referral');
const { applyFeeWaiver, applyAirtimeReward } = require('../services/referral.service');
const { success, error, badRequest } = require('../utils/apiResponse');

// GET /api/referrals?status=pending — platform admin only
const listReferrals = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status === 'pending') {
      filter.$or = [{ feeWaiverStatus: 'pending' }, { airtimeStatus: 'pending' }];
    }
    const referrals = await Referral.find(filter)
      .populate('referrerSchoolId', 'name referralCode')
      .populate('referrerUserId',   'fullName email phone role')
      .populate('referredSchoolId', 'name')
      .sort({ createdAt: -1 });
    return success(res, { referrals });
  } catch (err) { return error(res, err.message); }
};

// POST /api/referrals/:id/reward/fee-waiver — platform admin only
const rewardFeeWaiver = async (req, res) => {
  try {
    const referral = await applyFeeWaiver(req.params.id, req.user._id);
    return success(res, { referral }, 'Platform fee waived for 1 month');
  } catch (err) { return badRequest(res, err.message); }
};

// POST /api/referrals/:id/reward/airtime — platform admin only
const rewardAirtime = async (req, res) => {
  try {
    const referral = await applyAirtimeReward(req.params.id, req.user._id);
    return success(res, { referral }, 'Airtime reward sent');
  } catch (err) { return badRequest(res, err.message); }
};
// controllers/referral.controller.js
const ReferralReward = require("../models/ReferralReward");
const vtu = require("../services/vtu.service");

exports.claimReward = async (req, res) => {
  const { rewardId } = req.params;
  const { phoneNumber, network } = req.body;
  const userId = req.user.id; // from auth middleware — not admin-supplied

  // Atomically lock: only succeeds if still unclaimed AND owned by this user
  const reward = await ReferralReward.findOneAndUpdate(
    { _id: rewardId, ownerId: userId, status: "unclaimed" },
    { status: "processing", phoneNumber, network },
    { new: true }
  );
  if (!reward) return res.status(409).json({ error: "Reward already claimed or not yours" });

  try {
    const { requestId } = await vtu.buyAirtime({ phoneNumber, network, amount: reward.amount });
    reward.vtpassRequestId = requestId;
    reward.status = "claimed";
    reward.claimedAt = new Date();
    await reward.save();
    return res.json({ message: "Airtime sent", reward });
  } catch (err) {
    reward.status = "failed";
    await reward.save();
    return res.status(502).json({ error: "VTU purchase failed, try again" });
  }
};

module.exports = { listReferrals, rewardFeeWaiver, rewardAirtime };