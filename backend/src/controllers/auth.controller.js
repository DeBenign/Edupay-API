// src/controllers/auth.controller.js
const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const { env } = require('../config/env');
const { success, created, badRequest, unauthorized, forbidden, notFound, error } = require('../utils/apiResponse');

const { isPlatformAdminEmail } = require('../middleware/platformAdmin.middleware');
const { approvalInfoFor } = require('../services/schoolApproval.service');
const emailVerification = require('../services/emailVerification.service');
const passwordReset = require('../services/passwordReset.service');
const notify = require('../services/notify.service');

const signToken = (id) => jwt.sign({ id }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

const register = async (req, res) => {
  try {
    const { fullName, password, role, phone, acceptedTerms } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!fullName || !email || !password || !role) return badRequest(res, 'fullName, email, password, and role are required');
    // Public sign-up is for school applicants (admin) and parents only.
    // Bursars are created by their school's admin. EduPay owners are provisioned by script.
    if (role === 'bursar') return badRequest(res, 'Bursar accounts are created by your school administrator, not by public sign-up');
    if (!['admin', 'parent'].includes(role)) return badRequest(res, 'role must be admin or parent');
    if (isPlatformAdminEmail(email)) return forbidden(res, 'This email is reserved. Sign in instead, or use a different email');
    if (String(password).length < 8) return badRequest(res, 'Password must be at least 8 characters');
    if (role === 'admin' && acceptedTerms !== true) return badRequest(res, 'Please confirm you have read how EduPay pricing, privacy and subscription work');
    const existing = await User.findOne({ email });
    if (existing) return badRequest(res, 'An account with this email already exists');
    const user  = await User.create({ fullName, email, password, role, phone, emailVerified: false, ...(role === 'admin' && { termsAcceptedAt: new Date() }) });
    const token = signToken(user._id);
    const approval = await approvalInfoFor(user);
    const mail  = await emailVerification.sendVerification(user); // never throws
    return created(res, { user: { ...user.toJSON(), isPlatformAdmin: false, ...approval }, token, verificationEmailSent: Boolean(mail?.sent) }, 'Account created successfully');
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
    const approval = await approvalInfoFor(user);
    return success(res, { user: { ...user.toJSON(), isPlatformAdmin: isPlatformAdminEmail(user.email), ...approval }, token }, 'Login successful');

  } catch (err) {
    console.error('login error:', err.message);
    return error(res);
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('schoolId', 'name email logoUrl');
    if (!user) return notFound(res, 'User not found');
    const approval = await approvalInfoFor(user);
    return success(res, { user: { ...user.toJSON(), isPlatformAdmin: isPlatformAdminEmail(user.email), ...approval } });
  } catch (err) { return error(res); }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return badRequest(res, 'currentPassword and newPassword are required');
    if (newPassword.length < 8) return badRequest(res, 'New password must be at least 8 characters');
     if (newPassword === currentPassword) return badRequest(res, 'New password must be different from the current one');
    const user = await User.findById(req.user._id).select('+password');
    if (!await user.comparePassword(currentPassword)) return badRequest(res, 'Current password is incorrect');
    user.password = newPassword;
     user.mustChangePassword = false;
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

// POST /api/auth/verify-email   (public: the link in the email)
const verifyEmail = async (req, res) => {
  try {
    const token = String(req.body?.token || '');
    if (!/^[a-f0-9]{64}$/.test(token)) return badRequest(res, 'This verification link is not valid');
    const user = await emailVerification.verifyToken(token);
    if (!user) return badRequest(res, 'This link is invalid, already used or expired. Sign in and ask for a new one.');
    return success(res, { verified: true }, 'Email verified');
  } catch (err) { console.error('verifyEmail error:', err.message); return error(res); }
};

// POST /api/auth/resend-verification   (signed in, unverified)
const resendVerification = async (req, res) => {
  try {
    if (req.user.emailVerified !== false) return success(res, { alreadyVerified: true }, 'Your email is already verified');
    const wait = emailVerification.cooldownLeftSeconds(req.user);
    if (wait > 0) return res.status(429).json({ success: false, retryAfter: wait, message: `Please wait ${wait} seconds before asking for another email` });
    const mail = await emailVerification.sendVerification(req.user);
    if (!mail.sent && mail.reason === 'error') return error(res, 'We could not send the email right now. Please try again shortly.');
    return success(res, { sent: Boolean(mail.sent) }, mail.sent ? 'Verification email sent' : 'Email is not configured on this server');
  } catch (err) { console.error('resendVerification error:', err.message); return error(res); }
};

const FORGOT_REPLY = 'If an account exists for that email, we have sent a link to reset the password.';

// POST /api/auth/forgot-password   (public). Always the same reply, so it cannot be used to find out who has an account.
const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || email.length > 254 || !email.includes('@')) return badRequest(res, 'Enter your email address');
    const user = await User.findOne({ email });
    if (user && user.isActive && passwordReset.cooldownLeftSeconds(user) === 0) await passwordReset.sendReset(user);
    return success(res, null, FORGOT_REPLY);
  } catch (err) { console.error('forgotPassword error:', err.message); return error(res); }
};

// POST /api/auth/reset-password   (public: the link in the email)
const resetPassword = async (req, res) => {
  try {
    const token = String(req.body?.token || '');
    const password = String(req.body?.password || '');
    if (!/^[a-f0-9]{64}$/.test(token)) return badRequest(res, 'This reset link is not valid');
    if (password.length < 8) return badRequest(res, 'Password must be at least 8 characters'); // checked first, so a typo does not burn the link
    const user = await passwordReset.claimToken(token);
    if (!user) return badRequest(res, 'This link is invalid, already used or expired. Ask for a new one.');
    user.password = password;
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();                       // signs out every older session
    if (user.emailVerified === false) { user.emailVerified = true; user.emailVerifiedAt = new Date(); } // they proved they own the inbox
    await user.save();
    await notify.passwordChanged(user);
    return success(res, null, 'Password updated. You can now sign in.');
  } catch (err) { console.error('resetPassword error:', err.message); return error(res); }
};

module.exports = { forgotPassword, resetPassword, register, login, getMe, changePassword, createStaff, verifyEmail, resendVerification };
