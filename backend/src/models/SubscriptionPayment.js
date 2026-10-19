const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  schoolId:    { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  amount:      { type: Number, required: true, min: 1 },
  terms:       { type: Number, default: 1, min: 1 },
  reference:   { type: String, required: true, unique: true },
  coversUntil: { type: Date, required: true },
  note:        String,
  recordedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
module.exports = mongoose.models.SubscriptionPayment || mongoose.model('SubscriptionPayment', schema);