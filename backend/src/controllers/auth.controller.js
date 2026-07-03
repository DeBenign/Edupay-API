// src/controllers/auth.controller.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const School = require('../models/School');
const { env } = require('../config/env');
const {
  success, created, badRequest, unauthorized, notFound, error,
} = require('../utils/apiResponse');

// ─── Helper: sign JWT ─────────────────────────────────────────────────────────
const signToken = (userId) =>
  jwt.sign({ id: userId }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

// ─── POST /api/auth/register ──────────────────────────────────────────────────
// Admin registers first (no schoolId required).
// Bursar and Parent must be created by an Admin and will have schoolId attached.
const register = async (req, res) => {
  try {
    const { fullName, email, password, role, phone } = req.body;

    if (!fullName || !email || !password || !role) {
      return badRequest(res, 'fullName, email, password, and role are required');
    }

    const allowedRoles = ['admin', 'bursar', 'parent'];
    if (!allowedRoles.includes(role)) {
      return badRequest(res, `role must be one of: ${allowedRoles.join(', ')}`);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return badRequest(res, 'An account with this email already exists');
    }

    const user = await User.create({ fullName, email, password, role, phone });

    const token = signToken(user._id);

    return created(res, { user, token }, 'Account created successfully');
  } catch (err) {
    console.error('❌ register error:', err.message);
    return error(res, 'Registration failed. Please try again.');
  }
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return badRequest(res, 'Email and password are required');
    }

    // Explicitly select password (it's excluded by default)
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return unauthorized(res, 'Invalid email or password');
    }

    if (!user.isActive) {
      return unauthorized(res, 'Your account has been deactivated. Contact your administrator.');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);

    // Remove password from output
    user.password = undefined;

    return success(res, { user, token }, 'Login successful');
  } catch (err) {
    console.error('❌ login error:', err.message);
    return error(res, 'Login failed. Please try again.');
  }
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('schoolId', 'name email logoUrl');

    if (!user) return notFound(res, 'User not found');

    return success(res, { user });
  } catch (err) {
    console.error('❌ getMe error:', err.message);
    return error(res);
  }
};

// ─── PATCH /api/auth/change-password ─────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return badRequest(res, 'currentPassword and newPassword are required');
    }

    if (newPassword.length < 8) {
      return badRequest(res, 'New password must be at least 8 characters');
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return notFound(res, 'User not found');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return badRequest(res, 'Current password is incorrect');

    user.password = newPassword;
    await user.save();

    return success(res, null, 'Password changed successfully');
  } catch (err) {
    console.error('❌ changePassword error:', err.message);
    return error(res);
  }
};

// ─── POST /api/auth/create-staff ─────────────────────────────────────────────
// Admin-only: create bursar or parent accounts linked to their school
const createStaff = async (req, res) => {
  try {
    const { fullName, email, password, role, phone } = req.body;

    if (!fullName || !email || !password || !role) {
      return badRequest(res, 'fullName, email, password, and role are required');
    }

    if (!['bursar', 'parent'].includes(role)) {
      return badRequest(res, 'role must be either "bursar" or "parent"');
    }

    // Admin must have a school to create staff
    if (!req.user.schoolId) {
      return badRequest(res, 'Admin must belong to a school before creating staff');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return badRequest(res, 'An account with this email already exists');

    const newUser = await User.create({
      fullName,
      email,
      password,
      role,
      phone,
      schoolId: req.user.schoolId,
    });

    return created(res, { user: newUser }, `${role} account created successfully`);
  } catch (err) {
    console.error('❌ createStaff error:', err.message);
    return error(res);
  }
};

module.exports = { register, login, getMe, changePassword, createStaff };
