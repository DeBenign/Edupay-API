// src/controllers/auth.controller.js
const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const { env } = require('../config/env');
const { success, created, badRequest, unauthorized, notFound, error } = require('../utils/apiResponse');

const signToken = (id) => jwt.sign({ id }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

const register = async (req, res) => {
  try {
    const { fullName, email, password, role, phone } = req.body;
    if (!fullName || !email || !password || !role) return badRequest(res, 'fullName, email, password, and role are required');
    if (!['admin','bursar','parent'].includes(role)) return badRequest(res, 'role must be admin, bursar, or parent');
    const existing = await User.findOne({ email });
    if (existing) return badRequest(res, 'An account with this email already exists');
    const user  = await User.create({ fullName, email, password, role, phone });
    const token = signToken(user._id);
    return created(res, { user, token }, 'Account created successfully');
  } catch (err) {
    console.error('register error:', err.message);
    return error(res, err.message);
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return badRequest(res, 'Email and password are required');
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) return unauthorized(res, 'Invalid email or password');
    if (!user.isActive) return unauthorized(res, 'Account deactivated. Contact your administrator.');
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });
    const token = signToken(user._id);
    user.password = undefined;
    return success(res, { user, token }, 'Login successful');
  } catch (err) {
    console.error('login error:', err.message);
    return error(res);
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('schoolId', 'name email logoUrl');
    if (!user) return notFound(res, 'User not found');
    return success(res, { user });
  } catch (err) { return error(res); }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return badRequest(res, 'currentPassword and newPassword are required');
    if (newPassword.length < 8) return badRequest(res, 'New password must be at least 8 characters');
    const user = await User.findById(req.user._id).select('+password');
    if (!await user.comparePassword(currentPassword)) return badRequest(res, 'Current password is incorrect');
    user.password = newPassword;
    await user.save();
    return success(res, null, 'Password changed successfully');
  } catch (err) { return error(res); }
};

const createStaff = async (req, res) => {
  try {
    const { fullName, email, password, role, phone } = req.body;
    if (!fullName || !email || !password || !role) return badRequest(res, 'fullName, email, password, and role are required');
    if (!['bursar','parent'].includes(role)) return badRequest(res, 'role must be bursar or parent');
    if (!req.user.schoolId) return badRequest(res, 'Admin must belong to a school before creating staff');
    const existing = await User.findOne({ email });
    if (existing) return badRequest(res, 'An account with this email already exists');
    const newUser = await User.create({ fullName, email, password, role, phone, schoolId: req.user.schoolId });
    return created(res, { user: newUser }, `${role} account created successfully`);
  } catch (err) {
    console.error('createStaff error:', err.message);
    return error(res, err.message);
  }
};

module.exports = { register, login, getMe, changePassword, createStaff };
