// src/models/User.js
const crypto   = require('crypto');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName:    { type: String, required: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true, minlength: 8, select: false },
  role:        { type: String, enum: ['admin','bursar','parent'], required: true },
  schoolId:    { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null },
  phone:       { type: String, trim: true },
  isActive:    { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false },
  // Set when a school administrator accepts how EduPay pricing, privacy and subscription work
  termsAcceptedAt: { type: Date, default: null },
  // Email verification. No default on purpose: accounts created before this feature (undefined) count as verified.
  emailVerified:   { type: Boolean },
  emailVerifiedAt: { type: Date },
  emailVerifySentAt:    { type: Date },
  emailVerifyTokenHash: { type: String, select: false },
  emailVerifyExpires:   { type: Date,   select: false },
  // Password reset by email (single-use, 1 hour, hashed at rest)
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpires:   { type: Date,   select: false },
  passwordResetSentAt:    { type: Date },
  passwordChangedAt:      { type: Date },   // sessions issued before this are signed out
  lastLoginAt: { type: Date, default: null },
  // Personal code, shared to refer a NEW school. The reward is claimed from the user's own dashboard.
  referralCode: { type: String, unique: true, sparse: true, uppercase: true },
}, { timestamps: true });

userSchema.pre('validate', function () {
  if (!this.referralCode) {
    const prefix = (this.fullName || 'USER').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'USER';
    this.referralCode = `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }
});

// Hash the password once (async hook, no next())
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.emailVerifyTokenHash;
  delete obj.emailVerifyExpires;
  delete obj.passwordResetTokenHash;
  delete obj.passwordResetExpires;
  return obj;
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);