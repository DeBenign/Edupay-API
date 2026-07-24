// src/models/Student.js
const mongoose = require('mongoose');

const virtualAccountSchema = new mongoose.Schema({
  accountNumber:  { type: String, default: null },
  accountName:    { type: String, default: null },
  bankName:       { type: String, default: null },
  bankCode:       { type: String, default: null },
  accountHolderId:{ type: String, default: null },
  accountRef:     { type: String, default: null },
  provisionedAt:  { type: Date, default: null },
  // Which payment gateway this account lives on. Existing documents have no
  // value here and default to 'nomba' — matches every account provisioned
  // before this field existed.
  gateway:        { type: String, enum: ['nomba', 'paystack'], default: 'nomba' },
}, { _id: false });


const studentSchema = new mongoose.Schema({
  schoolId:       { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  parentId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User',   default: null },
  fullName:       { type: String, required: true, trim: true },
  studentId:      { type: String, required: true, trim: true },
  class:          { type: String, required: true, trim: true },
  gender:         { type: String, enum: ['male','female'], required: true },
  dateOfBirth:    { type: Date,   default: null },
  virtualAccount: { type: virtualAccountSchema, default: () => ({}) },
  isActive:       { type: Boolean, default: true },
}, { timestamps: true });

studentSchema.index({ schoolId: 1, studentId: 1 }, { unique: true });
studentSchema.index({ 'virtualAccount.accountNumber': 1 });

module.exports = mongoose.models.Student || mongoose.model('Student', studentSchema);