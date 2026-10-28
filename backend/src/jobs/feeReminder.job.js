// src/jobs/feeReminder.job.js
// Daily cron: finds students with outstanding fees due within 3 days and 1 day.
// Sends reminder notifications to linked parents.

const cron = require('node-cron');
const FeeAssignment = require('../models/FeeAssignment');
const User = require('../models/User');
const School = require('../models/School');
const notificationService = require('../services/notification.service');
const notify = require('../services/notify.service');

const inBatches = async (items, size, fn) => {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
};

const sendReminders = async (daysAhead) => {
  const now        = new Date();
  const targetDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  // Find all partial/unpaid assignments whose fee due date falls on the target day
  const startOfDay = new Date(targetDate.setHours(0,  0,  0, 0));
  const endOfDay   = new Date(targetDate.setHours(23, 59, 59, 999));

  const assignments = await FeeAssignment.find({
    status: { $in: ['unpaid', 'partial'] },
  })
    .populate({
      path: 'feeStructureId',
      match: { dueDate: { $gte: startOfDay, $lte: endOfDay }, isActive: true },
      select: 'name term academicSession dueDate amount',
    })
    .populate('studentId', 'fullName studentId parentId')
    .lean();

  // Filter out assignments where fee didn't match the date range
  const due = assignments.filter((a) => a.feeStructureId && a.studentId);

  if (due.length === 0) {
    console.log(`ℹ️  [CRON] No fees due in ${daysAhead} day(s)`);
    return;
  }

  console.log(`⏰ [CRON] Sending reminders for ${due.length} fee(s) due in ${daysAhead} day(s)`);
  await notificationService.createDueDateReminders(due);

  // Also email the parents (verified, active, linked). One lookup for all parents and schools.
  const parentIds = [...new Set(due.map((a) => String(a.studentId.parentId || '')).filter(Boolean))];
  if (!parentIds.length) return;
  const [parents, schools] = await Promise.all([
    User.find({ _id: { $in: parentIds } }).select('email fullName emailVerified isActive').lean(),
    School.find({ _id: { $in: [...new Set(due.map((a) => String(a.schoolId)))] } }).select('name').lean(),
  ]);
  const parentOf = Object.fromEntries(parents.map((p) => [String(p._id), p]));
  const schoolOf = Object.fromEntries(schools.map((s) => [String(s._id), s]));
  await inBatches(due.filter((a) => a.studentId.parentId), 10, (a) =>
    notify.feeDueReminder(parentOf[String(a.studentId.parentId)], {
      school: schoolOf[String(a.schoolId)] || { name: 'your school' },
      studentName: a.studentId.fullName, feeName: a.feeStructureId.name, balance: a.balance,
      dueDate: a.feeStructureId.dueDate, daysLeft: daysAhead,
    }));
};

const runFeeReminders = async () => {
  await sendReminders(3); // 3-day warning
  await sendReminders(1); // 1-day final warning
};

// Long-running host: schedules itself. Vercel: /api/cron/reminders calls runFeeReminders instead.
if (!process.env.VERCEL) {
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ [CRON] Daily fee reminder job triggered');
    try { await runFeeReminders(); } catch (err) { console.error('❌ [CRON] Fee reminder job failed:', err.message); }
  }, { timezone: 'Africa/Lagos' });
  console.log('✅ Fee reminder cron job registered (daily 08:00, Africa/Lagos)');
}

module.exports = { runFeeReminders, sendReminders };
