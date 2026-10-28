// src/controllers/school.controller.js
const School = require('../models/School');
const notify = require('../services/notify.service');
const User   = require('../models/User');
const Referral = require('../models/Referral');
const { success, created, badRequest, notFound, error, forbidden } = require('../utils/apiResponse');

const createSchool = async (req, res) => {
  try {
    const { name, address, email, phone, referralCode, applicantPosition } = req.body;
    if (!name || !address || !email) return badRequest(res, 'name, address, and email are required');
    if (!phone?.trim()) return badRequest(res, 'A contact phone number is required so EduPay can verify your school');
    if (!applicantPosition?.trim() || applicantPosition.trim().length < 2) return badRequest(res, 'Tell us your position at the school (for example Proprietor, Principal, Bursar)');
    if (req.user.schoolId) return badRequest(res, 'You already belong to a school');
    const now = new Date();
    const school = await School.create({
      name, address, email, phone, applicantPosition: applicantPosition.trim(), createdBy: req.user._id,
      approval: { status: 'pending', submittedAt: now, history: [{ status: 'pending', by: req.user._id, at: now, note: 'Application submitted' }] },
    });
    await notify.applicationSubmitted(school, req.user); // never throws
    await User.findByIdAndUpdate(req.user._id, { schoolId: school._id });

    // Referral trail — rewards convert automatically on the referred school's
// first payment (see referral.service.js's checkReferralConversion).
if (referralCode) {
  const code = referralCode.trim().toUpperCase();
  const referrerSchool = await School.findOne({ referralCode: code });
  const referrerUser   = !referrerSchool ? await User.findOne({ referralCode: code }) : null;

  if ((referrerSchool || referrerUser) && String(referrerUser?._id) !== String(req.user._id)) {
    school.referredBySchoolId = referrerSchool?._id || null;
    school.referredByUserId   = referrerUser?._id || null;
    await school.save();

    await Referral.create({
      code,
      referrerSchoolId: referrerSchool?._id || null,
      referrerUserId:   referrerUser?._id || null,
      referrerRole:     referrerUser?.role || null,   // ← NEW — required by createAirtimeReward
      referredSchoolId: school._id,
      feeWaiverStatus:  referrerSchool ? 'pending' : 'none',
      airtimeStatus:    referrerUser   ? 'pending' : 'none',
    });
  }
      // An unrecognized code is silently ignored rather than blocking signup —
      // a typo in a referral code shouldn't stop a school from registering.
 }

    return created(res, { school }, 'School created successfully');
  } catch (err) {
    console.error('createSchool error:', err.message);
    return error(res, err.message);
  }
};

const getMySchool = async (req, res) => {
  try {
    if (!req.user.schoolId) return notFound(res, 'You are not associated with any school');
    // The applicant sees their status and EduPay's message, never EduPay's internal verification notes
    const school = await School.findById(req.user.schoolId).select('-approval.verificationNote -approval.history').populate('createdBy','fullName email');
    if (!school) return notFound(res, 'School not found');
    return success(res, { school });
  } catch (err) { return error(res); }
};

const updateSchool = async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) return notFound(res, 'School not found');
    if (school.createdBy.toString() !== req.user._id.toString()) return forbidden(res, 'Only the school owner can update school details');

    if (req.body.payoutBank !== undefined) {
      const { accountNumber, bankCode, accountName } = req.body.payoutBank || {};
      if (!/^\d{10}$/.test(String(accountNumber || '')) || !bankCode || !accountName?.trim())
        return badRequest(res, 'payoutBank needs a 10-digit accountNumber, a bankCode and an accountName');
      school.payoutBank = { accountNumber: String(accountNumber), bankCode: String(bankCode), accountName: accountName.trim() };
    }

    if (req.body.earlyPaymentDiscountEnabled !== undefined && typeof req.body.earlyPaymentDiscountEnabled !== 'boolean')
      return badRequest(res, 'earlyPaymentDiscountEnabled must be true or false');

    const status = school.approval?.status || 'approved';
    if (status !== 'approved' && req.body.payoutBank !== undefined) return forbidden(res, 'Payout details can be added once your school is approved');
    const allowed = ['name','address','email','phone','logoUrl', 'earlyPaymentDiscountEnabled', 'applicantPosition'];
    allowed.forEach(f => { if (req.body[f] !== undefined) school[f] = req.body[f]; });
    await school.save();
    return success(res, { school }, 'School updated successfully');
  } catch (err) { return error(res); }
};

module.exports = { createSchool, getMySchool, updateSchool };