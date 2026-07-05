// src/models/FeeStructure.js
const mongoose = require('mongoose');

const feeStructureSchema = new mongoose.Schema({
  schoolId:        { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name:            { type: String, required: true, trim: true },
  class:           { type: String, required: true, trim: true },
  amount:          { type: Number, required: true, min: 0 },
  academicSession: { type: String, required: true, trim: true },
  term:            { type: String, enum: ['first','second','third'], required: true },
  dueDate:         { type: Date,   required: true },
  isActive:        { type: Boolean, default: true },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

feeStructureSchema.index({ schoolId: 1, class: 1, term: 1, academicSession: 1 }, { unique: true });

module.exports = mongoose.models.FeeStructure || mongoose.model('FeeStructure', feeStructureSchema);
