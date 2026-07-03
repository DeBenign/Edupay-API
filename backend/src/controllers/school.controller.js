// src/controllers/school.controller.js
const School = require('../models/School');
const User = require('../models/User');
const { success, created, badRequest, notFound, error, forbidden } = require('../utils/apiResponse');

// ─── POST /api/schools ────────────────────────────────────────────────────────
// Admin creates their school. Admin can only own one school.
const createSchool = async (req, res) => {
  try {
    const { name, address, email, phone } = req.body;

    if (!name || !address || !email) {
      return badRequest(res, 'name, address, and email are required');
    }

    // Prevent admin from creating multiple schools
    if (req.user.schoolId) {
      return badRequest(res, 'You already belong to a school');
    }

    const school = await School.create({
      name,
      address,
      email,
      phone,
      createdBy: req.user._id,
    });

    // Link this school back to the admin user
    await User.findByIdAndUpdate(req.user._id, { schoolId: school._id });

    return created(res, { school }, 'School created successfully');
  } catch (err) {
    console.error('❌ createSchool error:', err.message);
    return error(res);
  }
};

// ─── GET /api/schools/me ──────────────────────────────────────────────────────
// Returns the school the logged-in user belongs to
const getMySchool = async (req, res) => {
  try {
    if (!req.user.schoolId) {
      return notFound(res, 'You are not associated with any school');
    }

    const school = await School.findById(req.user.schoolId)
      .populate('createdBy', 'fullName email');

    if (!school) return notFound(res, 'School not found');

    return success(res, { school });
  } catch (err) {
    console.error('❌ getMySchool error:', err.message);
    return error(res);
  }
};

// ─── PATCH /api/schools/:id ───────────────────────────────────────────────────
const updateSchool = async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) return notFound(res, 'School not found');

    // Only the admin who created it can update it
    if (school.createdBy.toString() !== req.user._id.toString()) {
      return forbidden(res, 'Only the school owner can update school details');
    }

    const allowed = ['name', 'address', 'email', 'phone', 'logoUrl'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) school[field] = req.body[field];
    });

    await school.save();

    return success(res, { school }, 'School updated successfully');
  } catch (err) {
    console.error('❌ updateSchool error:', err.message);
    return error(res);
  }
};

module.exports = { createSchool, getMySchool, updateSchool };
