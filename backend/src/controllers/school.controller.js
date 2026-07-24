// src/controllers/school.controller.js
const School = require('../models/School');
const User   = require('../models/User');
const Referral = require('../models/Referral');
const { success, created, badRequest, notFound, error, forbidden } = require('../utils/apiResponse');

const createSchool = async (req, res) => {
  try {
    const { name, address, email, phone, referralCode } = req.body;
    if (!name || !address || !email) return badRequest(res, 'name, address, and email are required');
    if (req.user.schoolId) return badRequest(res, 'You already belong to a school');
    const school = await School.create({ name, address, email, phone, createdBy: req.user._id });
    await User.findByIdAndUpdate(req.user._id, { schoolId: school._id });

    // Referral trail — reward itself is applied manually by an admin later
    // (see referral.controller.js), this just records who gets credit.
    if (referralCode) {
      const code = referralCode.trim().toUpperCase();
      const referrerSchool = await School.findOne({ referralCode: code });
      const referrerUser   = !referrerSchool ? await User.findOne({ referralCode: code }) : null;

      if (referrerSchool || referrerUser) {
        school.referredBySchoolId = referrerSchool?._id || null;
        school.referredByUserId   = referrerUser?._id || null;
        await school.save();

        await Referral.create({
          code,
          referrerSchoolId: referrerSchool?._id || null,
          referrerUserId:   referrerUser?._id || null,
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
    const school = await School.findById(req.user.schoolId).populate('createdBy','fullName email');
    if (!school) return notFound(res, 'School not found');
    return success(res, { school });
  } catch (err) { return error(res); }
};

const updateSchool = async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) return notFound(res, 'School not found');
    if (school.createdBy.toString() !== req.user._id.toString()) return forbidden(res, 'Only the school owner can update school details');
    if (req.body.paymentGateway !== undefined && ![null, 'nomba', 'paystack'].includes(req.body.paymentGateway)) {
      return badRequest(res, "paymentGateway must be 'nomba', 'paystack', or null");
    }
    const allowed = ['name','address','email','phone','logoUrl','paymentGateway'];
    allowed.forEach(f => { if (req.body[f] !== undefined) school[f] = req.body[f]; });
    await school.save();
    return success(res, { school }, 'School updated successfully');
  } catch (err) { return error(res); }
};

module.exports = { createSchool, getMySchool, updateSchool };