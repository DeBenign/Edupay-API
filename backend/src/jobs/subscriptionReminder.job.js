// src/jobs/subscriptionReminder.job.js
// Daily: email school admins before and after their subscription ends. Each reminder is sent once.
//   7d: within 7 days of the end  ·  1d: within 1 day  ·  grace: ended, still in grace
//   locked: grace ended in the last 3 days (so schools locked long ago are not surprised after a rollout)
// Long-running host: schedules itself. Vercel: /api/cron/reminders calls runSubscriptionReminders.
const cron    = require('node-cron');
const School  = require('../models/School');
const Student = require('../models/Student');
const User    = require('../models/User');
const sub     = require('../services/subscriptionAccess.service');
const notify  = require('../services/notify.service');

const LOCKED_WINDOW_DAYS = 3;

const kindFor = (school, now) => {
  const end = sub.activeUntilOf(school);
  const graceEnds = end + sub.graceDays() * sub.DAY_MS;
  const extended = school.subscription?.extendedUntil ? new Date(school.subscription.extendedUntil).getTime() : 0;
  if (extended > now) return null;                       // EduPay gave them more time
  if (now < end) {
    const daysLeft = Math.ceil((end - now) / sub.DAY_MS);
    return daysLeft <= 1 ? { kind: '1d', end, daysLeft } : daysLeft <= 7 ? { kind: '7d', end, daysLeft } : null;
  }
  if (now < graceEnds) return { kind: 'grace', end, graceEndsAt: graceEnds };
  if (now - graceEnds <= LOCKED_WINDOW_DAYS * sub.DAY_MS) return { kind: 'locked', end, graceEndsAt: graceEnds };
  return null;
};

const runSubscriptionReminders = async (now = Date.now()) => {
  const schools = await School.find({
    isActive: true,
    $or: [{ 'approval.status': 'approved' }, { 'approval.status': { $exists: false } }],
  }).select('name email subscription createdAt').lean();

  const due = [];
  for (const school of schools) {
    const k = kindFor(school, now);
    if (!k) continue;
    const key = `${new Date(k.end).toISOString().slice(0, 10)}:${k.kind}`;
    if ((school.subscription?.remindersSent || []).includes(key)) continue;
    due.push({ school, key, ...k });
  }
  if (!due.length) return { sent: 0 };

  const ids = due.map((d) => d.school._id);
  const [counts, admins] = await Promise.all([
    Student.aggregate([{ $match: { isActive: true, schoolId: { $in: ids } } }, { $group: { _id: '$schoolId', n: { $sum: 1 } } }]),
    User.find({ schoolId: { $in: ids }, role: 'admin', isActive: true }).select('email fullName schoolId').lean(),
  ]);
  const enrolledOf = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));

  let sent = 0;
  for (const d of due) {
    const to = admins.filter((a) => String(a.schoolId) === String(d.school._id));
    if (!to.length) continue;
    const { amountDue } = sub.priceFor(enrolledOf[String(d.school._id)] || 0, d.school.subscription?.peakStudents || 0);
    const result = await notify.subscriptionReminder(d.school, to, {
      kind: d.kind, endDate: new Date(d.end), daysLeft: d.daysLeft, graceEndsAt: d.graceEndsAt ? new Date(d.graceEndsAt) : undefined,
      amountDue, payTo: sub.payToConfigured() ? sub.PAY_TO : null,
    });
    if (result?.sent) {                                  // only remember what was really delivered
      await School.updateOne({ _id: d.school._id }, { $push: { 'subscription.remindersSent': { $each: [d.key], $slice: -12 } } });
      sent++;
    }
  }
  return { sent };
};

if (!process.env.VERCEL) {
  cron.schedule('0 9 * * *', () => runSubscriptionReminders().catch((e) => console.error('❌ [CRON] Subscription reminders failed:', e.message)), { timezone: 'Africa/Lagos' });
  console.log('✅ Subscription reminder cron job registered (daily 09:00, Africa/Lagos)');
}

module.exports = { runSubscriptionReminders, kindFor };
