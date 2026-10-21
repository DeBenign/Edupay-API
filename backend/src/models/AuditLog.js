const mongoose = require('mongoose');
module.exports = mongoose.model('AuditLog', new mongoose.Schema({
  actorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action:   { type: String, required: true }, // deactivate | reactivate | reset_password
}, { timestamps: true }));