// src/services/passwordReset.service.js
// Single-use, 1-hour reset tokens, stored only as a hash.
const crypto = require('crypto');
const User   = require('../models/User');
const notify = require('./notify.service');

const TTL_MS      = 60 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');

const cooldownLeftSeconds = (user) => {
  const last = user.passwordResetSentAt ? new Date(user.passwordResetSentAt).getTime() : 0;
  return Math.max(0, Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000));
};

// A new request replaces any earlier link.
const sendReset = async (user) => {
  const raw = crypto.randomBytes(32).toString('hex');
  await User.updateOne({ _id: user._id }, { $set: { passwordResetTokenHash: sha256(raw), passwordResetExpires: new Date(Date.now() + TTL_MS), passwordResetSentAt: new Date() } });
  return notify.passwordResetEmail(user, `${notify.appUrl()}/reset-password?token=${raw}`);
};

// Atomic: the token is consumed the moment it is claimed, so it can only ever be used once.
const claimToken = (raw) => User.findOneAndUpdate(
  { passwordResetTokenHash: sha256(String(raw)), passwordResetExpires: { $gt: new Date() }, isActive: true },
  { $unset: { passwordResetTokenHash: '', passwordResetExpires: '' } },
  { new: true },
);

module.exports = { sendReset, claimToken, cooldownLeftSeconds, sha256 };
