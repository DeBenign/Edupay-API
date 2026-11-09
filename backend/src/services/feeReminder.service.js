// src/services/feeReminder.service.js
// Fee reminders to parents: before the due date (3 days, 1 day, today), after it (weekly, up to a cap),
// and on demand from a bursar or admin. Channels: in-app, email, and SMS (opt-in per school).
const FeeAssignment = require('../models/FeeAssignment');
const FeeStructure  = require('../models/FeeStructure');
const Student       = require('../models/Student');
const User          = require('../models/User');
const School        = require('../models/School');
const ReminderLog   = require('../models/ReminderLog');
const { Notification } = require('../models/WebhookLog');
const notify = require('./notify.service');
const sms    = require('./sms.service');
const { accessOf } = require('./subscriptionAccess.service');

const DAY = 24 * 60 * 60 * 1000;
const LAGOS_OFFSET = 60 * 60 * 1000;                       // Nigeria is UTC+1 all year
const OVERDUE_EVERY_DAYS = Number(process.env.OVERDUE_REMINDER_EVERY_DAYS) || 7;
const OVERDUE_MAX        = Number(process.env.OVERDUE_REMINDER_MAX) || 4;
const OVERDUE_WINDOW_DAYS = 120;                           // do not chase fees that have been overdue for months
const MANUAL_COOLDOWN_MS = DAY;                            // one manual reminder per fee per day

const dayStart = (d) => { const t = new Date(new Date(d).getTime() + LAGOS_OFFSET); t.setUTCHours(0, 0, 0, 0); return new Date(t.getTime() - LAGOS_OFFSET); };
// Whole days from today (Lagos) to the due day: 3 = in three days, 0 = today, -2 = two days overdue
const daysFromToday = (due, now = new Date()) => Math.round((dayStart(due) - dayStart(now)) / DAY);
const naira = (n) => `₦${Number(n || 0).toLocaleString('en-NG')}`;
const shortDate = (d) => new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const inBatches = async (items, size, fn) => { for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn)); };

// ── Wording ──────────────────────────────────────────────────────────────────
const inAppContent = ({ studentName, feeName, balance, dueDate, days }) => days >= 0
  ? { type: 'due_reminder',
      title: days === 0 ? 'Fee due today' : `Fee due in ${plural(days, 'day')}`,
      message: `${studentName}'s ${feeName} balance of ${naira(balance)} is due ${days === 0 ? 'today' : `on ${shortDate(dueDate)}`}. Please make payment to avoid any disruption.` }
  : { type: 'overdue_reminder',
      title: `Fee overdue by ${plural(-days, 'day')}`,
      message: `${studentName}'s ${feeName} balance of ${naira(balance)} was due on ${shortDate(dueDate)}. Please pay as soon as you can, or speak to the school bursar if you need help.` };

const smsText = ({ school, studentName, feeName, balance, dueDate, days }) => {
  const when = days > 1 ? `is due in ${days} days (${shortDate(dueDate)})` : days === 1 ? 'is due tomorrow'
    : days === 0 ? 'is due today' : `was due on ${shortDate(dueDate)} and is overdue`;
  return `${school.name}: ${studentName}'s ${feeName} balance of ${naira(balance)} ${when}. Pay to the student's EduPay account number. ${notify.appUrl()}`;
};

const schoolLocked = (school) => { try { return accessOf(school).locked; } catch { return false; } };
// SMS costs money, so it needs: the school switched it on, the provider configured, and the school not locked
const smsAllowedFor = (school) => school?.reminders?.smsEnabled === true && sms.configured() && !schoolLocked(school);

// ── Send one reminder on every channel and log it ────────────────────────────
const dispatch = async ({ assignment, student, fee, parent, school, kind, days, sentBy = null }) => {
  const ids = { schoolId: assignment.schoolId, assignmentId: assignment._id, studentId: student._id, parentId: student.parentId };
  const logs = []; const out = {};
  const log = (channel, status, reason) => {
    out[channel] = status;
    logs.push({ ...ids, kind, channel, status, ...(reason ? { reason } : {}), ...(sentBy ? { sentBy } : {}) });
  };
  const base = { studentName: student.fullName, feeName: fee.name, balance: assignment.balance, dueDate: fee.dueDate, days };

  try {
    await Notification.create({ userId: student.parentId, schoolId: assignment.schoolId, ...inAppContent(base),
      metadata: { studentId: student._id, feeAssignmentId: assignment._id, balance: assignment.balance, dueDate: fee.dueDate, daysLeft: days } });
    log('inapp', 'sent');
  } catch (err) { console.error('In-app reminder failed:', err.message); log('inapp', 'failed', 'error'); }

  if (!notify.emailable(parent)) {
    log('email', 'skipped', parent?.email ? 'unverified_or_inactive' : 'no_email');
  } else {
    const ctx = { school, studentName: student.fullName, feeName: fee.name, balance: assignment.balance, dueDate: fee.dueDate };
    const r = days < 0
      ? await notify.feeOverdueReminder(parent, { ...ctx, overdueDays: -days })
      : await notify.feeDueReminder(parent, { ...ctx, daysLeft: days });
    const ok = Boolean(r?.sent || r?.queued);
    log('email', ok ? 'sent' : 'failed', ok ? (r.queued ? 'queued_for_retry' : undefined) : r?.reason);
  }

  if (smsAllowedFor(school)) {
    if (!parent?.phone) log('sms', 'skipped', 'no_phone');
    else {
      const r = await sms.sendSms(parent.phone, smsText({ ...base, school }));
      log('sms', r.sent ? 'sent' : 'failed', r.sent ? undefined : r.reason);
    }
  }

  await ReminderLog.insertMany(logs, { ordered: false }).catch((e) => console.error('Reminder log failed:', e.message));
  return { channels: out, delivered: Object.values(out).includes('sent') };
};

// ── Daily job ────────────────────────────────────────────────────────────────
const sendBatch = async ({ assignments, feeById, kindFor, overdue, deadline }) => {
  if (!assignments.length) return 0;
  const now = new Date(); const today = dayStart(now);
  const students = await Student.find({ _id: { $in: assignments.map((a) => a.studentId) }, isActive: { $ne: false } })
    .select('fullName studentId parentId schoolId').lean();
  const studentOf = new Map(students.map((s) => [String(s._id), s]));
  const parentIds = [...new Set(students.map((s) => String(s.parentId || '')).filter(Boolean))];
  const schoolIds = [...new Set(assignments.map((a) => String(a.schoolId)))];
  const [parents, schools] = await Promise.all([
    parentIds.length ? User.find({ _id: { $in: parentIds } }).select('email fullName phone emailVerified isActive').lean() : [],
    School.find({ _id: { $in: schoolIds } }).select('name subscription createdAt reminders').lean(),
  ]);
  const parentOf = new Map(parents.map((p) => [String(p._id), p]));
  const schoolOf = new Map(schools.map((s) => [String(s._id), s]));

  const work = assignments.filter((a) => {
    const s = studentOf.get(String(a.studentId)); const school = schoolOf.get(String(a.schoolId));
    if (!s?.parentId || !school) return false;
    if (overdue && school.reminders?.overdueEnabled === false) return false;
    const kind = kindFor(feeById.get(String(a.feeStructureId)));
    // Already reminded today for this kind (the job was run twice): skip, never double-send
    return !(a.reminders?.lastAt && new Date(a.reminders.lastAt) >= today && a.reminders.lastKind === kind);
  });

  const ops = []; let delivered = 0;
  await inBatches(work, 10, async (a) => {
    if (Date.now() > deadline) return;             // out of time: the rest are picked up by the next run
    const student = studentOf.get(String(a.studentId)); const fee = feeById.get(String(a.feeStructureId));
    const days = daysFromToday(fee.dueDate, now); const kind = kindFor(fee);
    const r = await dispatch({ assignment: a, student, fee, parent: parentOf.get(String(student.parentId)),
      school: schoolOf.get(String(a.schoolId)), kind, days });
    if (!r.delivered) return;
    delivered++;
    ops.push({ updateOne: { filter: { _id: a._id }, update: {
      $set: { 'reminders.lastAt': now, 'reminders.lastKind': kind, ...(overdue ? { 'reminders.lastOverdueAt': now } : {}) },
      ...(overdue ? { $inc: { 'reminders.overdueCount': 1 } } : {}) } } });
  });
  if (ops.length) await FeeAssignment.bulkWrite(ops, { ordered: false });
  return delivered;
};

const processUpcoming = async (daysAhead, deadline) => {
  const start = new Date(dayStart(new Date()).getTime() + daysAhead * DAY);
  const end = new Date(start.getTime() + DAY - 1);
  const fees = await FeeStructure.find({ dueDate: { $gte: start, $lte: end }, isActive: true }).select('name dueDate').lean();
  if (!fees.length) return 0;
  const assignments = await FeeAssignment.find({ feeStructureId: { $in: fees.map((f) => f._id) }, status: { $in: ['unpaid', 'partial'] }, balance: { $gt: 0 } })
    .select('studentId schoolId feeStructureId balance reminders').lean();
  const kind = daysAhead === 3 ? 'due_3d' : daysAhead === 1 ? 'due_1d' : 'due_today';
  return sendBatch({ assignments, feeById: new Map(fees.map((f) => [String(f._id), f])), kindFor: () => kind, overdue: false, deadline });
};

// Overdue: first reminder the day after the due date, then every OVERDUE_EVERY_DAYS, at most OVERDUE_MAX times
const processOverdue = async (deadline) => {
  const now = new Date(); const today = dayStart(now);
  const fees = await FeeStructure.find({ isActive: true, dueDate: { $lt: today, $gte: new Date(today.getTime() - OVERDUE_WINDOW_DAYS * DAY) } })
    .select('name dueDate').lean();
  if (!fees.length) return 0;
  const cutoff = new Date(now.getTime() - (OVERDUE_EVERY_DAYS * DAY - 60 * 60 * 1000));
  const assignments = await FeeAssignment.find({
    feeStructureId: { $in: fees.map((f) => f._id) }, status: { $in: ['unpaid', 'partial'] }, balance: { $gt: 0 },
    'reminders.overdueCount': { $not: { $gte: OVERDUE_MAX } },
    $or: [{ 'reminders.lastOverdueAt': null }, { 'reminders.lastOverdueAt': { $lte: cutoff } }],
  }).select('studentId schoolId feeStructureId balance reminders').limit(2000).lean();
  return sendBatch({ assignments, feeById: new Map(fees.map((f) => [String(f._id), f])), kindFor: () => 'overdue', overdue: true, deadline });
};

const runFeeReminders = async ({ budgetMs = 20000 } = {}) => {
  const deadline = Date.now() + budgetMs;
  const upcoming = [];
  for (const d of [3, 1, 0]) upcoming.push(await processUpcoming(d, deadline));
  const overdue = await processOverdue(deadline);
  console.log(`⏰ [CRON] Fee reminders sent: ${upcoming.reduce((a, b) => a + b, 0)} upcoming, ${overdue} overdue`);
  return { upcoming: upcoming.reduce((a, b) => a + b, 0), overdue };
};

// ── Bursar / admin: remind one parent now ────────────────────────────────────
const channelsSummary = (out) => {
  const names = { inapp: 'in-app', email: 'email', sms: 'SMS' };
  const sentTo = Object.keys(out).filter((c) => out[c] === 'sent').map((c) => names[c]);
  return sentTo.length ? `Reminder sent by ${sentTo.join(', ')}.` : 'The reminder could not be delivered.';
};

const sendManualReminder = async ({ assignmentId, user }) => {
  const a = await FeeAssignment.findById(assignmentId);
  if (!a || String(a.schoolId) !== String(user.schoolId)) return { ok: false, code: 'not_found', message: 'Fee assignment not found' };
  if (!['unpaid', 'partial'].includes(a.status) || !(a.balance > 0)) return { ok: false, code: 'settled', message: 'This fee is already settled, so there is nothing to remind.' };
  const last = a.reminders?.lastManualAt ? new Date(a.reminders.lastManualAt).getTime() : 0;
  if (Date.now() - last < MANUAL_COOLDOWN_MS) {
    const hours = Math.ceil((MANUAL_COOLDOWN_MS - (Date.now() - last)) / (60 * 60 * 1000));
    return { ok: false, code: 'too_soon', message: `A reminder was already sent for this fee. You can send another in about ${plural(hours, 'hour')}.` };
  }
  const [student, fee, school] = await Promise.all([
    Student.findById(a.studentId).select('fullName studentId parentId schoolId').lean(),
    FeeStructure.findById(a.feeStructureId).select('name dueDate').lean(),
    School.findById(a.schoolId).select('name subscription createdAt reminders').lean(),
  ]);
  if (!student || !fee || !school) return { ok: false, code: 'not_found', message: 'Fee assignment not found' };
  const parent = student.parentId
    ? await User.findById(student.parentId).select('email fullName phone emailVerified isActive').lean() : null;
  if (!parent || parent.isActive === false) {
    return { ok: false, code: 'no_parent', message: 'No parent is linked to this student yet, so there is nobody to remind. Ask the parent to link this student first.' };
  }
  const r = await dispatch({ assignment: a, student, fee, parent, school, kind: 'manual', days: daysFromToday(fee.dueDate), sentBy: user._id });
  if (!r.delivered) return { ok: false, code: 'failed', message: 'The reminder could not be delivered. Please try again.', channels: r.channels };
  const now = new Date();
  await FeeAssignment.updateOne({ _id: a._id }, { $set: { 'reminders.lastManualAt': now, 'reminders.lastAt': now, 'reminders.lastKind': 'manual' } });
  return { ok: true, channels: r.channels, message: channelsSummary(r.channels) };
};

module.exports = { runFeeReminders, processUpcoming, processOverdue, sendManualReminder, daysFromToday, dayStart, smsText, inAppContent };
