// src/models/School.js
const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'School name is required'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'School email is required'],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    logoUrl: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('School', schoolSchema);
