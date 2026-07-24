// src/services/referral.service.js
const Referral = require('../models/Referral');
const School   = require('../models/School');
const User     = require('../models/User');
const { topUpAirtime } = require('./airtime.service');

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// Task 2i — waive the referring school's platformFee for 1 month.
const applyFeeWaiver = async (referralId, adminUserId) => {
  const referral = await Referral.findById(referralId);
  if (!referral) throw new Error('Referral not found');
  if (!referral.referrerSchoolId) throw new Error('This referral has no referring school to waive fees for');
  if (referral.feeWaiverStatus === 'applied') throw new Error('Fee waiver already applied for this referral');

  await School.findByIdAndUpdate(referral.referrerSchoolId, {
    platformFeeWaivedUntil: new Date(Date.now() + ONE_MONTH_MS),
  });

  referral.feeWaiverStatus = 'applied';
  referral.feeWaiverAppliedAt = new Date();
  referral.processedBy = adminUserId;
  await referral.save();

  return referral;
};

// Task 2ii — send the referring user ₦2,000 airtime.
const applyAirtimeReward = async (referralId, adminUserId) => {
  const referral = await Referral.findById(referralId);
  if (!referral) throw new Error('Referral not found');
  if (!referral.referrerUserId) throw new Error('This referral has no referring user to reward');
  if (referral.airtimeStatus === 'sent') throw new Error('Airtime already sent for this referral');

  const user = await User.findById(referral.referrerUserId);
  if (!user?.phone) throw new Error('Referring user has no phone number on file');

  const result = await topUpAirtime({ phone: user.phone, amount: referral.airtimeAmount });

  referral.airtimeStatus    = result.success ? 'sent' : 'failed';
  referral.airtimeReference = result.reference;
  referral.airtimeSentAt    = result.success ? new Date() : null;
  referral.processedBy      = adminUserId;
  await referral.save();

  if (!result.success) throw new Error('Airtime top-up failed — see referral record for details');
  return referral;
};

module.exports = { applyFeeWaiver, applyAirtimeReward };