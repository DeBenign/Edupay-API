// src/controllers/referral.controller.js
const Referral = require('../models/Referral');
const ReferralReward = require('../models/ReferralReward');
const { applyFeeWaiver } = require('../services/referral.service');
const vtu = require('../services/vtu.service');
const { success, error, badRequest } = require('../utils/apiResponse');

// ─── Platform admin ──────────────────────────────────────────────────────────
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

// ─── Reward owner (admin / bursar / parent) ──────────────────────────────────

// A purchase left "processing" (for example after a timeout) is settled by asking the provider
const settleProcessing = async (rewards) => {
  for (const r of rewards) {
    if (r.status !== 'processing' || !r.vtpassRequestId) continue;
    if (Date.now() - new Date(r.updatedAt).getTime() < 60 * 1000) continue; // give it a minute
    try {
      const { state } = await vtu.checkStatus(r.vtpassRequestId);
      if (state === 'delivered') { r.status = 'claimed'; r.claimedAt = r.claimedAt || new Date(); await r.save(); }
      else if (state === 'failed') { r.status = 'failed'; await r.save(); }
    } catch { /* leave as processing and try again next time */ }
  }
};

const getMyRewards = async (req, res) => {
  try {
    const rewards = await ReferralReward.find({ ownerId: req.user._id }).sort({ createdAt: -1 });
    await settleProcessing(rewards);
    return success(res, { rewards });
  } catch (err) { return error(res, err.message); }
};

const getDataPlans = async (req, res) => {
  try {
    const network = String(req.query.network || '').toLowerCase();
    if (!vtu.NETWORKS.includes(network)) return badRequest(res, 'Choose a network');
    const max = Number(req.query.maxAmount) || Infinity;
    const plans = (await vtu.getDataPlans(network)).filter((p) => p.amount <= max);
    return success(res, { plans });
  } catch (err) { return error(res, 'Could not load data plans right now'); }
};

const claimReward = async (req, res) => {
  try {
    const { rewardId } = req.params;
    const network = String(req.body.network || '').toLowerCase();
    const rewardType = req.body.rewardType === 'data' ? 'data' : 'airtime';
    const phone = vtu.normalizePhone(req.body.phoneNumber);

    if (!phone) return badRequest(res, 'Enter a valid Nigerian phone number');
    if (!vtu.NETWORKS.includes(network)) return badRequest(res, 'Choose a network');

    const existing = await ReferralReward.findOne({ _id: rewardId, ownerId: req.user._id });
    if (!existing) return badRequest(res, 'Reward not found');
    if (existing.status === 'claimed') return badRequest(res, 'This reward has already been claimed');
    if (existing.status === 'processing') return badRequest(res, 'This reward is still being processed. Check again in a minute.');

    // A failed attempt may still have gone through at the provider. Check before buying again.
    if (existing.status === 'failed' && existing.vtpassRequestId) {
      try {
        const prev = await vtu.checkStatus(existing.vtpassRequestId);
        if (prev.state === 'delivered') {
          existing.status = 'claimed'; existing.claimedAt = new Date(); await existing.save();
          return success(res, { reward: existing }, 'Your earlier attempt went through. Reward claimed.');
        }
        if (prev.state === 'pending') return badRequest(res, 'Your earlier attempt is still being processed. Check again in a minute.');
      } catch { return badRequest(res, 'Could not confirm your earlier attempt. Try again shortly.'); }
    }

    // Data: the server re-checks the plan and its price, never the client's word
    let plan = null;
    if (rewardType === 'data') {
      const plans = await vtu.getDataPlans(network);
      plan = plans.find((p) => p.code === req.body.variationCode);
      if (!plan || plan.amount > existing.amount) return badRequest(res, 'Choose a data plan within your reward value');
    }

    const reward = await ReferralReward.findOneAndUpdate(
      { _id: rewardId, ownerId: req.user._id, status: { $in: ['unclaimed', 'failed'] } },
      {
        $set: { status: 'processing', phoneNumber: phone, network, rewardType, variationCode: plan?.code || null, planName: plan?.name || null },
        $inc: { attempts: 1 },
      },
      { returnDocument: 'after' }
    );
    if (!reward) return badRequest(res, 'Reward already claimed or being processed');

    // Saved BEFORE calling the provider, so a crash can always be checked afterwards
    const requestId = `EDUPAY-RWD-${reward._id}-${reward.attempts}`;
    reward.vtpassRequestId = requestId;
    await reward.save();

    try {
      const result = rewardType === 'data'
        ? await vtu.buyData({ requestId, phoneNumber: phone, network, variationCode: plan.code, amount: plan.amount })
        : await vtu.buyAirtime({ requestId, phoneNumber: phone, network, amount: reward.amount });

      if (result.state === 'delivered') {
        reward.status = 'claimed'; reward.claimedAt = new Date(); await reward.save();
        return success(res, { reward }, rewardType === 'data' ? 'Data sent' : 'Airtime sent');
      }
      if (result.state === 'pending') {
        return success(res, { reward }, 'Your reward is being processed. It will show as claimed once the network confirms.');
      }
      reward.status = 'failed'; await reward.save();
      return error(res, 'The network could not complete this purchase. Please try again.');
    } catch (vtuErr) {
      if (vtuErr.response) {
        reward.status = 'failed'; await reward.save();
        return error(res, 'The provider rejected this request. Please try again.');
      }
      // No response (timeout or network drop): it may still have gone through.
      // Leave it "processing" so it is checked later, never re-bought blindly.
      return success(res, { reward }, 'We are confirming this with the network. Check back in a minute.');
    }
  } catch (err) { return error(res, err.message); }
};

module.exports = { listReferrals, rewardFeeWaiver, getMyRewards, getDataPlans, claimReward };