const Referral = require('../models/Referral');
const School = require('../models/School');
const Payment = require('../models/Payment');
const ReferralReward = require('../models/ReferralReward');

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

const applyFeeWaiver = async (referralId, adminUserId, session = null) => {
  const referral = await Referral.findById(referralId).session(session);
  if (!referral) throw new Error('Referral not found');
  if (!referral.referrerSchoolId) throw new Error('This referral has no referring school to waive fees for');
  if (referral.feeWaiverStatus === 'applied') return null;

  await School.findByIdAndUpdate(
    referral.referrerSchoolId,
    { platformFeeWaivedUntil: new Date(Date.now() + ONE_MONTH_MS) },
    { session }
  );

  referral.feeWaiverStatus = 'applied';
  referral.feeWaiverAppliedAt = new Date();
  referral.processedBy = adminUserId;
  await referral.save({ session });
  return referral;
};

async function createAirtimeReward(referral, session = null) {
  const [reward] = await ReferralReward.create(
    [{
      ownerId: referral.referrerUserId,
      ownerType: referral.referrerRole,
      referralId: referral._id,
      amount: referral.airtimeAmount || 2000,
    }],
    { session }
  );
  return reward;
}

async function checkReferralConversion(schoolId, session = null) {
  const referral = await Referral.findOne({
    referredSchoolId: schoolId,
    $or: [{ airtimeStatus: 'pending' }, { feeWaiverStatus: 'pending' }],
  }).session(session);
  if (!referral) return;

  const paymentCount = await Payment.countDocuments({ schoolId }).session(session);
  if (paymentCount !== 1) return;

  try {
    if (referral.airtimeStatus === 'pending' && referral.referrerUserId) {
      await createAirtimeReward(referral, session);
      referral.airtimeStatus = 'reward_created';
    }
    if (referral.feeWaiverStatus === 'pending' && referral.referrerSchoolId) {
      await applyFeeWaiver(referral._id, null, session);
      referral.feeWaiverStatus = 'applied';
    }
    await referral.save({ session });
  } catch (err) {
    console.error('⚠️  Referral conversion error (payment still processed):', err.message);
  }
}

module.exports = { applyFeeWaiver, createAirtimeReward, checkReferralConversion };