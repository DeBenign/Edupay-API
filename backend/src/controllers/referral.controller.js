const Referral = require('../models/Referral');
const ReferralReward = require('../models/ReferralReward');
const { applyFeeWaiver } = require('../services/referral.service');
const vtu = require('../services/vtu.service');
const { success, error, badRequest } = require('../utils/apiResponse');

const listReferrals = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status === 'pending') {
      filter.$or = [{ feeWaiverStatus: 'pending' }, { airtimeStatus: 'pending' }];
    }
    const referrals = await Referral.find(filter)
      .populate('referrerSchoolId', 'name referralCode')
      .populate('referrerUserId', 'fullName email phone role')
      .populate('referredSchoolId', 'name')
      .sort({ createdAt: -1 });
    return success(res, { referrals });
  } catch (err) { return error(res, err.message); }
};

const rewardFeeWaiver = async (req, res) => {
  try {
    const referral = await applyFeeWaiver(req.params.id, req.user._id);
    if (!referral) return badRequest(res, 'Fee waiver already applied or not pending');
    return success(res, { referral }, 'Platform fee waived for 1 month');
  } catch (err) { return badRequest(res, err.message); }
};

const getMyRewards = async (req, res) => {
  try {
    const rewards = await ReferralReward.find({ ownerId: req.user._id }).sort({ createdAt: -1 });
    return success(res, { rewards });
  } catch (err) { return error(res, err.message); }
};

const claimReward = async (req, res) => {
  try {
    const { rewardId } = req.params;
    const { phoneNumber, network } = req.body;
    const userId = req.user._id;

    const reward = await ReferralReward.findOneAndUpdate(
      { _id: rewardId, ownerId: userId, status: 'unclaimed' },
      { status: 'processing', phoneNumber, network },
      { new: true }
    );
    if (!reward) return badRequest(res, 'Reward already claimed or not yours');

    try {
      const { requestId } = await vtu.buyAirtime({ phoneNumber, network, amount: reward.amount });
      reward.vtpassRequestId = requestId;
      reward.status = 'claimed';
      reward.claimedAt = new Date();
      await reward.save();
      return success(res, { reward }, 'Airtime sent');
    } catch (vtuErr) {
      reward.status = 'failed';
      await reward.save();
      return error(res, 'VTU purchase failed, try again');
    }
  } catch (err) { return error(res, err.message); }
};

module.exports = { listReferrals, rewardFeeWaiver, getMyRewards, claimReward };