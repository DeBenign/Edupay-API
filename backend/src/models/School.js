// src/models/School.js
const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  address:   { type: String, required: true, trim: true },
  email:     { type: String, required: true, lowercase: true, trim: true },
  phone:     { type: String, trim: true },
  logoUrl:   { type: String, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive:  { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.models.School || mongoose.model('School', schoolSchema);
