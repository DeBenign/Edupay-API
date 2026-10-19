// src/models/User.js
const crypto = require('crypto');
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
  lastLoginAt: { type: Date, default: null },
 // Personal referral code — any admin/bursar/parent can share this to refer
// a NEW school. The referring user automatically becomes eligible for a
// ₦2,000 airtime reward once the referred school makes its first payment
// (see referral.service.js's checkReferralConversion) — claimed self-serve
// by the user from their own dashboard, not sent by an admin.
referralCode: { type: String, unique: true, sparse: true, uppercase: true },
}, { timestamps: true });

// User.js: the usual shape
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Hash password — async hook, NO next() parameter in Mongoose 7+
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
  return obj;
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);