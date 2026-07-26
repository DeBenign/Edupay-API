const Referral = require('../models/Referral');
const School = require('../models/School');
const Payment = require('../models/Payment');
const ReferralReward = require('../models/ReferralReward');

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// Task 2i — waive the referring school's platformFee for 1 month.
// session is optional: passed when called from inside a payment transaction,
// omitted (null) when an admin triggers it manually as a one-off override.
const applyFeeWaiver = async (referralId, adminUserId, session = null) => {
  const referral = await Referral.findById(referralId).session(session);
  if (!referral) throw new Error('Referral not found');
  if (!referral.referrerSchoolId) throw new Error('This referral has no referring school to waive fees for');
  if (referral.feeWaiverStatus === 'applied') return null; // already applied — safe no-op, not an error

  await School.findByIdAndUpdate(
    referral.referrerSchoolId,
    { platformFeeWaivedUntil: new Date(Date.now() + ONE_MONTH_MS) },
    { session }
  );

  referral.feeWaiverStatus = 'applied';
  referral.feeWaiverAppliedAt = new Date();
  referral.processedBy = adminUserId; // null when auto-triggered by the system
  await referral.save({ session });

  return referral;
};

// Creates the claimable reward — the actual airtime send only happens later,
// self-serve, in referral.controller.js's claimReward.
async function createAirtimeReward(referral, session = null) {
  const [reward] = await ReferralReward.create(
    [{
      ownerId: referral.referrerUserId,
      ownerType: referral.referrerRole, // 'admin' | 'bursar' | 'parent'
      referralId: referral._id,
      amount: referral.airtimeAmount || 2000,
    }],
    { session }
  );
  return reward;
}

// Called from reconciliation.service.js's atomicWrite, inside the same
// transaction as the payment that might convert this referral.
async function checkReferralConversion(schoolId, session = null) {
  const referral = await Referral.findOne({
    referredSchoolId: schoolId,
    $or: [{ airtimeStatus: 'pending' }, { feeWaiverStatus: 'pending' }],
  }).session(session);
  if (!referral) return;

  const paymentCount = await Payment.countDocuments({ schoolId }).session(session);
  if (paymentCount !== 1) return; // only the school's first-ever payment converts a referral

  try {
    if (referral.airtimeStatus === 'pending' && referral.referrerUserId) {
      await createAirtimeReward(referral, session);
      referral.airtimeStatus = 'reward_created';
    }
    if (referral.feeWaiverStatus === 'pending' && referral.referrerSchoolId) {
      await applyFeeWaiver(referral._id, null, session); // null = system-triggered, not an admin
      referral.feeWaiverStatus = 'applied';
    }
    await referral.save({ session });
  } catch (err) {
    // A referral edge case must never break fee reconciliation for a real payment
    console.error('⚠️  Referral conversion error (payment still processed):', err.message);
  }
}

module.exports = { applyFeeWaiver, createAirtimeReward, checkReferralConversion };