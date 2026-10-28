// src/services/notify.service.js
// One place for every email EduPay sends. Each function is safe: it never throws.
// (Call as notify.fn(...), not destructured, so tests can replace them.)
const User   = require('../models/User');
const School = require('../models/School');
const email  = require('./email.service');
const outbox = require('./outbox.service');
const tpl   = require('../utils/emailTemplates');

const appUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/, '');
const ownerEmails = () => (process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean);

const safe = async (fn) => {
  try { return await fn(); }
  catch (err) { console.error('❌ Notification failed:', err.message); return { sent: false, reason: 'error' }; }
};
// reliable (default): try now with a deadline, queue for retry if the provider fails.
// reliable: false: just try once (verification and reset links expire; the person can ask again).
const deliver = (to, built, { reliable = true, kind = 'general' } = {}) => {
  if (!built) return { sent: false, reason: 'no_template' };
  return reliable ? outbox.sendReliably({ to, ...built }, kind) : email.sendEmail({ to, ...built });
};

const schoolAdmins = async (schoolId) =>
  User.find({ schoolId, role: 'admin', isActive: true }).select('email fullName').limit(5).lean();

const passwordResetEmail = (user, url) => safe(() => deliver(user.email, tpl.passwordReset({ name: user.fullName, url }), { reliable: false }));
const passwordChanged    = (user)      => safe(() => deliver(user.email, tpl.passwordChanged({ name: user.fullName })));

const verificationEmail = (user, url) => safe(() => deliver(user.email, tpl.verifyEmail({ name: user.fullName, url }), { reliable: false }));

// Applicant gets a receipt; the EduPay owner gets an alert with a link to the review screen.
const applicationSubmitted = (school, applicant) => safe(async () => {
  await deliver(applicant.email, tpl.applicationReceived({ name: applicant.fullName, school }));
  await deliver(ownerEmails(), tpl.ownerNewApplication({ school, applicant, url: `${appUrl()}/admin/approvals` }));
});
const applicationResubmitted = (school, applicant) => safe(() =>
  deliver(ownerEmails(), tpl.ownerNewApplication({ school, applicant, resubmitted: true, url: `${appUrl()}/admin/approvals` })));

// status: approved | needs_info | rejected | suspended | reinstated
const applicationDecided = (school, status, text, extra = {}) => safe(async () => {
  const applicant = await User.findById(school.createdBy).select('email fullName').lean();
  if (!applicant) return { sent: false, reason: 'no_recipient' };
  return deliver(applicant.email, tpl.applicationDecision({
    status, name: applicant.fullName, school, text, pilotEndsAt: extra.pilotEndsAt,
    url: status === 'needs_info' ? appUrl() : `${appUrl()}/login`,
  }), { kind: 'decision' });
});

const subscriptionPaymentRecorded = (school, payment) => safe(async () => {
  const admins = await schoolAdmins(school._id);
  return deliver(admins.map((a) => a.email), tpl.subscriptionReceipt({ school, payment }));
});

// The daily job records a reminder as sent only when it was delivered, and tries again tomorrow, so no queueing here.
const subscriptionReminder = (school, admins, ctx) => safe(() =>
  deliver(admins.map((a) => a.email), tpl.subscriptionReminder({ ...ctx, school, url: `${appUrl()}/login` }), { reliable: false }));

// ── Parents ──────────────────────────────────────────────────────────────────
// Only verified, active parents with an address get financial email.
const emailable = (u) => Boolean(u && u.email && u.isActive !== false && u.emailVerified !== false);

// A payment was credited to the child's fee (bank transfer or cash recorded by the school office).
const paymentReceived = (result, student) => safe(async () => {
  if (!student?.parentId) return { sent: false, reason: 'no_parent' };
  const [parent, school] = await Promise.all([
    User.findById(student.parentId).select('email fullName emailVerified isActive').lean(),
    School.findById(student.schoolId).select('name').lean(),
  ]);
  if (!emailable(parent)) return { sent: false, reason: 'no_recipient' };
  const feeLabel = result.feeName || [result.term, result.academicSession].filter(Boolean).join(' ') || 'school fees';
  return deliver(parent.email, tpl.paymentReceipt({
    parentName: parent.fullName, school: school || { name: 'your school' },
    p: { ...result, feeLabel, url: `${appUrl()}/login` },
  }), { kind: 'receipt' });
});

// Daily job: a fee is due soon. Returns { sent } like the other helpers.
const feeDueReminder = (parent, ctx) => safe(async () => {
  if (!emailable(parent)) return { sent: false, reason: 'no_recipient' };
  return deliver(parent.email, tpl.feeDueReminder({ ...ctx, parentName: parent.fullName, url: `${appUrl()}/login` }), { kind: 'fee_reminder' });
});

module.exports = { appUrl, emailable, paymentReceived, feeDueReminder, passwordResetEmail, passwordChanged, verificationEmail, applicationSubmitted, applicationResubmitted, applicationDecided, subscriptionPaymentRecorded, subscriptionReminder };
