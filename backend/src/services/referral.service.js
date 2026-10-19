// src/services/referral.service.js
const mongoose = require('mongoose');
const Referral       = require('../models/Referral');
const School         = require('../models/School');
const User           = require('../models/User');
const Payment        = require('../models/Payment');
const ReferralReward = require('../models/ReferralReward');

const DAY_MS = 24 * 60 * 60 * 1000;
const WAIVER_MS = 30 * DAY_MS;
const MAX_WAIVER_AHEAD_MS = 90 * DAY_MS; // stacked waivers can never run more than 90 days ahead

const REWARD_AMOUNT         = Number(process.env.REFERRAL_REWARD_AMOUNT) || 1000;
// A reward unlocks once the referred school has earned the platform this much real margin
const UNLOCK_MARGIN         = Number(process.env.REFERRAL_UNLOCK_MARGIN) || REWARD_AMOUNT * 2;
const MAX_REWARDS_PER_MONTH = Number(process.env.REFERRAL_MAX_REWARDS_PER_MONTH) || 5;

const normPhone = (p) => String(p || '').replace(/\D/g, '').replace(/^234/, '0');

// ─── Fee waiver (referring school) ───────────────────────────────────────────
const grantFeeWaiver = async (referral, adminUserId, session) => {
  const school = await School.findById(referral.referrerSchoolId).select('platformFeeWaivedUntil').session(session);
  if (!school) throw new Error('Referring school not found');

  const now = Date.now();
  const start = Math.max(now, school.platformFeeWaivedUntil ? school.platformFeeWaivedUntil.getTime() : 0);
  const until = Math.min(start + WAIVER_MS, now + MAX_WAIVER_AHEAD_MS);

  await School.updateOne({ _id: school._id }, { $set: { platformFeeWaivedUntil: new Date(until) } }, { session });

  referral.feeWaiverStatus = 'applied';
  referral.feeWaiverAppliedAt = new Date();
  if (adminUserId) referral.processedBy = adminUserId;
};

// Manual override used by the platform admin
const applyFeeWaiver = async (referralId, adminUserId, session = null) => {
  const referral = await Referral.findById(referralId).session(session);
  if (!referral) throw new Error('Referral not found');
  if (!referral.referrerSchoolId) throw new Error('This referral has no referring school to waive fees for');
  if (referral.feeWaiverStatus === 'applied') return null;

  await grantFeeWaiver(referral, adminUserId, session);
  await referral.save({ session });
  return referral;
};

// ─── Reward for a referring person (admin / bursar / parent) ─────────────────
// The owner picks airtime or a data plan when claiming; the reward itself is just a value.
const createReward = async (referral, session = null) => {
  const [reward] = await ReferralReward.create(
    [{
      ownerId:    referral.referrerUserId,
      ownerType:  referral.referrerRole,
      referralId: referral._id,
      amount:     referral.airtimeAmount || REWARD_AMOUNT,
    }],
    { session }
  );
  return reward;
};

// ─── Guards ──────────────────────────────────────────────────────────────────
const isSelfReferral = async (referral, session) => {
  if (referral.referrerSchoolId && String(referral.referrerSchoolId) === String(referral.referredSchoolId)) return true;

  const [referredSchool, referrerSchool, referrerUser] = await Promise.all([
    School.findById(referral.referredSchoolId).select('phone payoutBank').session(session).lean(),
    referral.referrerSchoolId ? School.findById(referral.referrerSchoolId).select('payoutBank').session(session).lean() : null,
    referral.referrerUserId   ? User.findById(referral.referrerUserId).select('phone schoolId').session(session).lean() : null,
  ]);

  // The referrer works at the school they "referred"
  if (referrerUser?.schoolId && String(referrerUser.schoolId) === String(referral.referredSchoolId)) return true;

  // Both sides pay out to the same bank account
  let referrerBank = referrerSchool?.payoutBank?.accountNumber;
  if (!referrerBank && referrerUser?.schoolId) {
    const own = await School.findById(referrerUser.schoolId).select('payoutBank').session(session).lean();
    referrerBank = own?.payoutBank?.accountNumber;
  }
  const referredBank = referredSchool?.payoutBank?.accountNumber;
  if (referrerBank && referredBank && referrerBank === referredBank) return true;

  // The referrer's phone is the referred school's phone
  if (referrerUser?.phone && referredSchool?.phone && normPhone(referrerUser.phone) === normPhone(referredSchool.phone)) return true;

  return false;
};

// Real margin earned from the school: service charges minus gateway fees, gateway payments only
const referredNetMargin = async (schoolId, session) => {
  const [agg] = await Payment.aggregate([
    { $match: { schoolId: new mongoose.Types.ObjectId(String(schoolId)), source: { $ne: 'manual' } } },
    { $group: { _id: null, fee: { $sum: '$platformFee' }, gateway: { $sum: '$gatewayFee' } } },
  ]).session(session);
  return (agg?.fee || 0) - (agg?.gateway || 0);
};

// ─── Conversion: runs after each gateway payment is safely saved ─────────────
async function checkReferralConversion(schoolId, session = null) {
  try {
    const referral = await Referral.findOne({
      referredSchoolId: schoolId,
      $or: [{ airtimeStatus: 'pending' }, { feeWaiverStatus: 'pending' }],
    }).session(session);
    if (!referral) return;

    if (await isSelfReferral(referral, session)) {
      if (referral.airtimeStatus === 'pending')   referral.airtimeStatus = 'blocked';
      if (referral.feeWaiverStatus === 'pending') referral.feeWaiverStatus = 'blocked';
      await referral.save({ session });
      console.warn(`⚠️  Referral ${referral._id} blocked as a likely self-referral`);
      return;
    }

    // Not earned yet: stay pending and check again after the next payment
    if ((await referredNetMargin(schoolId, session)) < UNLOCK_MARGIN) return;

    if (referral.airtimeStatus === 'pending' && referral.referrerUserId) {
      const since = new Date(Date.now() - 30 * DAY_MS);
      const recent = await ReferralReward.countDocuments({ ownerId: referral.referrerUserId, createdAt: { $gte: since } }).session(session);
      if (recent < MAX_REWARDS_PER_MONTH) {
        await createReward(referral, session);
        referral.airtimeStatus = 'reward_created';
      } // else it stays pending and converts on a later payment
    }

    if (referral.feeWaiverStatus === 'pending' && referral.referrerSchoolId) {
      await grantFeeWaiver(referral, null, session);
    }

    await referral.save({ session });
  } catch (err) {
    console.error('⚠️  Referral conversion error (payment still processed):', err.message);
  }
}

module.exports = {
  applyFeeWaiver,
  createReward,
  createAirtimeReward: createReward, // old name kept so nothing else breaks
  checkReferralConversion,
};