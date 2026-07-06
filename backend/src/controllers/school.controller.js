// src/controllers/school.controller.js
const School = require('../models/School');
const User   = require('../models/User');
const { success, created, badRequest, notFound, error, forbidden } = require('../utils/apiResponse');

const createSchool = async (req, res) => {
  try {
    const { name, address, email, phone } = req.body;
    if (!name || !address || !email) return badRequest(res, 'name, address, and email are required');
    if (req.user.schoolId) return badRequest(res, 'You already belong to a school');
    const school = await School.create({ name, address, email, phone, createdBy: req.user._id });
    await User.findByIdAndUpdate(req.user._id, { schoolId: school._id });
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
    const allowed = ['name','address','email','phone','logoUrl'];
    allowed.forEach(f => { if (req.body[f] !== undefined) school[f] = req.body[f]; });
    await school.save();
    return success(res, { school }, 'School updated successfully');
  } catch (err) { return error(res); }
};

module.exports = { createSchool, getMySchool, updateSchool };
