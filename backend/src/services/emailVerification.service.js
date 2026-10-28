// src/services/emailVerification.service.js
// Single-use, 24-hour, hashed-at-rest verification tokens.
// Legacy accounts (emailVerified undefined) count as verified; only new sign-ups start unverified.
const crypto = require('crypto');
const User   = require('../models/User');
const notify = require('./notify.service');
const { isPlatformAdminEmail } = require('../middleware/platformAdmin.middleware');

const TTL_MS      = 24 * 60 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');

const ALLOWED_WHILE_UNVERIFIED = [
  ['GET',   /^\/api\/auth\/me$/],
  ['POST',  /^\/api\/auth\/resend-verification$/],
  ['PATCH', /^\/api\/auth\/change-password$/],
];

// null = proceed, else the JSON body for a 403
const gateFor = (user, method, path) => {
  if (user.emailVerified !== false) return null;
  if (isPlatformAdminEmail(user.email)) return null;
  if (ALLOWED_WHILE_UNVERIFIED.some(([m, re]) => m === method && re.test(path))) return null;
  return { success: false, code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email address first. We sent you a link when you signed up.' };
};

const issueToken = async (userId) => {
  const raw = crypto.randomBytes(32).toString('hex');
  await User.updateOne({ _id: userId }, { $set: { emailVerifyTokenHash: sha256(raw), emailVerifyExpires: new Date(Date.now() + TTL_MS), emailVerifySentAt: new Date() } });
  return raw;
};

// Issues a fresh token (invalidating any earlier one) and emails the link.
const sendVerification = async (user) => {
  const raw = await issueToken(user._id);
  return notify.verificationEmail(user, `${notify.appUrl()}/verify-email?token=${raw}`);
};

// Atomic: a token can be used exactly once.
const verifyToken = (raw) => User.findOneAndUpdate(
  { emailVerifyTokenHash: sha256(String(raw)), emailVerifyExpires: { $gt: new Date() } },
  { $set: { emailVerified: true, emailVerifiedAt: new Date() }, $unset: { emailVerifyTokenHash: '', emailVerifyExpires: '' } },
  { new: true },
);

const cooldownLeftSeconds = (user) => {
  const last = user.emailVerifySentAt ? new Date(user.emailVerifySentAt).getTime() : 0;
  return Math.max(0, Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000));
};

module.exports = { gateFor, sendVerification, verifyToken, cooldownLeftSeconds, sha256 };
