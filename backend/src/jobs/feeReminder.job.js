// src/jobs/feeReminder.job.js
// Daily cron: finds students with outstanding fees due within 3 days and 1 day.
// Sends reminder notifications to linked parents.

const cron = require('node-cron');
const FeeAssignment = require('../models/FeeAssignment');
const { createDueDateReminders } = require('../services/notification.service');

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
  await createDueDateReminders(due);
};

// Run daily at 8:00 AM Lagos time
cron.schedule('0 8 * * *', async () => {
  console.log('⏰ [CRON] Daily fee reminder job triggered');
  try {
    await sendReminders(3); // 3-day warning
    await sendReminders(1); // 1-day final warning
  } catch (err) {
    console.error('❌ [CRON] Fee reminder job failed:', err.message);
  }
}, { timezone: 'Africa/Lagos' });

console.log('✅ Fee reminder cron job registered (daily 08:00, Africa/Lagos)');
