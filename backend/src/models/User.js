// src/models/User.js
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
}, { timestamps: true });

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
