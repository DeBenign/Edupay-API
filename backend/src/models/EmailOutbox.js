const mongoose = require('mongoose');
// Emails that could not be delivered the first time, retried by the daily job (or any pinger of /api/cron/emails).
const schema = new mongoose.Schema({
  to:      { type: [String], required: true },
  subject: { type: String, required: true },
  html:    { type: String },
  text:    { type: String },
  kind:    { type: String, default: 'general' },
  status:  { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending', index: true },
  attempts:      { type: Number, default: 1 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  lastError:     { type: String },
  sentAt:        { type: Date },
}, { timestamps: true });
schema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // housekeeping: drop records after 30 days
module.exports = mongoose.model('EmailOutbox', schema);
