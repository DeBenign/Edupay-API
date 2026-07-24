// src/models/School.js
const mongoose = require('mongoose');

const crypto = require('crypto');

const schoolSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  address:   { type: String, required: true, trim: true },
  email:     { type: String, required: true, lowercase: true, trim: true },
  phone:     { type: String, trim: true },
  logoUrl:   { type: String, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive:  { type: Boolean, default: true },
  // Which gateway new students at this school get provisioned on.
  // null = fall back to the global DEFAULT_PAYMENT_GATEWAY env var.
  paymentGateway: { type: String, enum: ['nomba', 'paystack', null], default: null },

  // ── Referrals ──────────────────────────────────────────────────────────
  // This school's own code, given out to refer OTHER schools.
  referralCode: { type: String, unique: true, sparse: true, uppercase: true },
  // Set if this school itself signed up via someone else's referral code.
  referredBySchoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null },
  referredByUserId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',   default: null },

  // ── Platform fee waiver (referral reward — applied manually by an admin) ─
  platformFeeWaivedUntil: { type: Date, default: null },

  // ── Payout destination for this school's revenue withdrawals ────────────
  payoutBank: {
    accountNumber: { type: String, default: null },
    bankCode:      { type: String, default: null },
    accountName:   { type: String, default: null },
  },
}, { timestamps: true });

schoolSchema.pre('validate', function (next) {
  if (!this.referralCode) {
    // e.g. "GREENFIELD-7K2N" — human-shareable, still collision-resistant
    const prefix = (this.name || 'SCHL').replace(/[^A-Za-z]/g, '').slice(0, 8).toUpperCase() || 'SCHL';
    const suffix = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
    this.referralCode = `${prefix}-${suffix}`;
  }
  next();
});

module.exports = mongoose.models.School || mongoose.model('School', schoolSchema);