// src/controllers/approval.controller.js
// EduPay owner reviews school applications. Applicants can resubmit when EduPay asks for more information.
const School   = require('../models/School');
const AuditLog = require('../models/AuditLog');
const { TERM_DAYS, DAY_MS, invalidate } = require('../services/subscriptionAccess.service');
const { clearApprovalCache } = require('../services/schoolApproval.service');
const notify = require('../services/notify.service');
const User = require('../models/User');
const email = require('../services/email.service');
const { isPlatformAdminEmail } = require('../middleware/platformAdmin.middleware');
const mongoose = require('mongoose');
const { success, badRequest, notFound, error } = require('../utils/apiResponse');

const plain = (a) => (a && typeof a.toObject === 'function' ? a.toObject() : (a || {}));
const MIN_TEXT = 5;

const audit = async (req, school, action, meta) => {
  try {
    await AuditLog.create({ actorId: req.user._id, schoolId: school._id, targetId: school._id, targetType: 'School', action, meta });
  } catch (err) { console.error(`❌ Approval saved but audit log failed (${action}):`, err.message); }
};

// One state machine for every decision, so the rules live in one place.
const decide = (cfg) => async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) return notFound(res, 'School not found');
    const from = school.approval?.status || 'approved';
    if (!cfg.from.includes(from)) return badRequest(res, `A school that is ${from} cannot be ${cfg.verb}`);

    const text = String(req.body?.[cfg.field] ?? '').trim();
    if (cfg.required && text.length < MIN_TEXT) return badRequest(res, cfg.required);
    if (cfg.check) { const problem = cfg.check(req.body); if (problem) return badRequest(res, problem); }

    const now = new Date();
    const prev = plain(school.approval);
    const history = [...(prev.history || []), { status: cfg.to, by: req.user._id, at: now, note: text || null }];
    school.approval = {
      ...prev, status: cfg.to, decidedAt: now, decidedBy: req.user._id, history,
      reason: cfg.to === 'rejected' || cfg.to === 'suspended' ? text : null,
      message: cfg.to === 'needs_info' ? text : null,
      verificationNote: cfg.to === 'approved' && text ? text : prev.verificationNote,
    };
    // A school's free pilot starts when it is approved, not when it signed up
    if (cfg.to === 'approved' && from !== 'suspended' && school.subscription) {
      school.subscription.pilotEndsAt = new Date(now.getTime() + TERM_DAYS * DAY_MS);
    }
    await school.save();
    await audit(req, school, cfg.action, { from, to: cfg.to, note: text || null });
    clearApprovalCache(); invalidate(school._id);
    // Tell the applicant. Internal verification notes are never emailed.
    await notify.applicationDecided(school, cfg.mail || cfg.to, text, { pilotEndsAt: school.subscription?.pilotEndsAt });
    return success(res, { schoolId: school._id, status: cfg.to }, cfg.done);
  } catch (err) { console.error(`${cfg.action} error:`, err.message); return error(res); }
};

const approveSchool = decide({
  from: ['pending', 'needs_info'], to: 'approved', verb: 'approved', field: 'verificationNote', action: 'school_approve',
  required: `Record how you verified the school (at least ${MIN_TEXT} characters)`,
  check: (b) => (b?.verifiedByCall === true ? null : 'Confirm that you verified the school by calling a number you trust'),
  done: 'School approved. Its free pilot starts now.',
});
const rejectSchool = decide({
  from: ['pending', 'needs_info'], to: 'rejected', verb: 'rejected', field: 'reason', action: 'school_reject',
  required: `A reason is required (at least ${MIN_TEXT} characters)`, done: 'Application rejected',
});
const requestInfo = decide({
  from: ['pending'], to: 'needs_info', verb: 'sent back for more information', field: 'message', action: 'school_request_info',
  required: `Say what you need from the applicant (at least ${MIN_TEXT} characters)`, done: 'Sent back to the applicant',
});
const suspendSchool = decide({
  from: ['approved'], to: 'suspended', verb: 'suspended', field: 'reason', action: 'school_suspend',
  required: `A reason is required (at least ${MIN_TEXT} characters)`, done: 'School suspended',
});
const reinstateSchool = decide({
  from: ['suspended'], to: 'approved', verb: 'reinstated', field: 'note', action: 'school_reinstate', mail: 'reinstated', done: 'School reinstated',
});

// GET /api/schools/applications?status=pending,needs_info   (platform admin)
// Deliberately contains no student counts or money: approval needs identity, not finances.
const listApplications = async (req, res) => {
  try {
    const wanted = String(req.query.status || 'pending,needs_info').split(',').map((s) => s.trim()).filter(Boolean);
    const clauses = wanted.map((s) => (s === 'approved'
      ? { $or: [{ 'approval.status': 'approved' }, { 'approval.status': { $exists: false } }] }
      : { 'approval.status': s }));
    const filter = clauses.length === 1 ? clauses[0] : { $or: clauses };
    const queue = wanted.every((s) => ['pending', 'needs_info'].includes(s));

    const [applications, grouped] = await Promise.all([
      School.find(filter)
        .select('name address email phone applicantPosition createdBy createdAt approval referredBySchoolId referredByUserId')
        .populate('createdBy', 'fullName email phone createdAt')
        .sort({ createdAt: queue ? 1 : -1 }).limit(100).lean(),
      School.aggregate([{ $group: { _id: { $ifNull: ['$approval.status', 'approved'] }, n: { $sum: 1 } } }]),
    ]);
    const counts = Object.fromEntries(grouped.map((g) => [g._id, g.n]));
    counts.waitingForEmail = await User.countDocuments({ role: 'admin', emailVerified: false, isActive: true });
    const shaped = applications.map((s) => ({ ...s, wasReferred: Boolean(s.referredBySchoolId || s.referredByUserId) }));
    return success(res, { applications: shaped, counts, emailConfigured: email.configured() });
  } catch (err) { console.error('listApplications error:', err.message); return error(res); }
};

// POST /api/schools/my/resubmit   (the applicant, after EduPay asked for more information)
const resubmitApplication = async (req, res) => {
  try {
    const school = await School.findOne({ _id: req.user.schoolId, createdBy: req.user._id });
    if (!school) return notFound(res, 'School not found');
    if ((school.approval?.status || 'approved') !== 'needs_info') return badRequest(res, 'Only an application EduPay asked more information on can be resubmitted');
    const now = new Date();
    const prev = plain(school.approval);
    school.approval = { ...prev, status: 'pending', submittedAt: now, message: null,
      history: [...(prev.history || []), { status: 'pending', by: req.user._id, at: now, note: 'Resubmitted with updates' }] };
    await school.save();
    await audit(req, school, 'school_resubmit', { from: 'needs_info', to: 'pending' });
    clearApprovalCache();
    await notify.applicationResubmitted(school, { fullName: req.user.fullName, email: req.user.email });
    return success(res, { status: 'pending' }, 'Application resubmitted');
  } catch (err) { console.error('resubmit error:', err.message); return error(res); }
};

// GET /api/schools/signups/unverified?role=admin|parent   (platform admin)
// People who signed up but have not confirmed their email. Normally empty within minutes; fills up if email is down.
const listUnverifiedSignups = async (req, res) => {
  try {
    const role = req.query.role === 'parent' ? 'parent' : 'admin';
    const [signups, admins, parents] = await Promise.all([
      User.find({ role, emailVerified: false, isActive: true }).select('fullName email phone role createdAt emailVerifySentAt').sort({ createdAt: 1 }).limit(100).lean(),
      User.countDocuments({ role: 'admin', emailVerified: false, isActive: true }),
      User.countDocuments({ role: 'parent', emailVerified: false, isActive: true }),
    ]);
    return success(res, { signups, counts: { admin: admins, parent: parents }, emailConfigured: email.configured() });
  } catch (err) { console.error('listUnverifiedSignups error:', err.message); return error(res); }
};

// POST /api/schools/signups/:userId/verify-email   (platform admin)
// The way forward when the mail system is down. It only clears the email check: a school still needs a call and an approval.
const verifyEmailManually = async (req, res) => {
  try {
    const note = String(req.body?.note || '').trim();
    if (note.length < MIN_TEXT) return badRequest(res, `Record why you are verifying this address yourself (at least ${MIN_TEXT} characters)`);
    if (!mongoose.isValidObjectId(req.params.userId)) return notFound(res, 'Account not found');
    const user = await User.findById(req.params.userId).select('fullName email role emailVerified');
    if (!user) return notFound(res, 'Account not found');
    if (user.emailVerified !== false) return badRequest(res, 'This account does not need verification');
    if (isPlatformAdminEmail(user.email)) return badRequest(res, 'This account does not need verification');
    await User.updateOne({ _id: user._id }, { $set: { emailVerified: true, emailVerifiedAt: new Date() }, $unset: { emailVerifyTokenHash: '', emailVerifyExpires: '' } });
    try {
      await AuditLog.create({ actorId: req.user._id, targetId: user._id, targetType: 'User', action: 'email_verify_manual', meta: { note, email: user.email, role: user.role } });
    } catch (auditErr) { console.error('❌ Manual verification saved but audit log failed:', auditErr.message); }
    return success(res, { userId: user._id }, 'Email marked as verified');
  } catch (err) { console.error('verifyEmailManually error:', err.message); return error(res); }
};

module.exports = { listUnverifiedSignups, verifyEmailManually, approveSchool, rejectSchool, requestInfo, suspendSchool, reinstateSchool, listApplications, resubmitApplication };
