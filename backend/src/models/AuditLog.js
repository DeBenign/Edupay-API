const mongoose = require('mongoose');
module.exports = mongoose.model('AuditLog', new mongoose.Schema({
  actorId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  schoolId:   { type: mongoose.Schema.Types.ObjectId, ref: 'School' }, // absent for actions on a person with no school yet
  targetId:   { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'targetType' },
  targetType: { type: String, enum: ['User', 'FeeAssignment', 'School'], default: 'User' },
  action:     { type: String, required: true }, // deactivate | reactivate | reset_password | fee_adjust | school_approve | school_reject | school_request_info | school_suspend | school_reinstate | school_resubmit | email_verify_manual
  meta:       { type: mongoose.Schema.Types.Mixed, default: undefined },
}, { timestamps: true }));
