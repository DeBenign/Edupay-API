// src/models/ReminderLog.js
// One row per reminder per channel, so a bursar can see what was sent and SMS spending can be audited.
const mongoose = require('mongoose');

const reminderLogSchema = new mongoose.Schema({
  schoolId:     { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeAssignment', required: true },
  studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  parentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  kind:    { type: String, enum: ['due_3d', 'due_1d', 'due_today', 'overdue', 'manual'], required: true },
  channel: { type: String, enum: ['inapp', 'email', 'sms'], required: true },
  status:  { type: String, enum: ['sent', 'failed', 'skipped'], required: true },
  reason:  { type: String },                                  // why it failed or was skipped
  sentBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // set for manual reminders
}, { timestamps: { createdAt: true, updatedAt: false } });

reminderLogSchema.index({ assignmentId: 1, createdAt: -1 });
reminderLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 }); // keep 6 months

module.exports = mongoose.models.ReminderLog || mongoose.model('ReminderLog', reminderLogSchema);
