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

module.exports = { listReferrals, rewardFeeWaiver, rewardAirtime };