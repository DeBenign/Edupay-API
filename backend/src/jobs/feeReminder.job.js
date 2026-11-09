// src/jobs/feeReminder.job.js
// Daily 08:00 (Lagos): reminders before the due date (3 days, 1 day, today) and after it (weekly, capped).
// The work lives in services/feeReminder.service.js so the bursar's "Remind now" button uses the same code.
const cron = require('node-cron');
const service = require('../services/feeReminder.service');

const runFeeReminders = (opts) => service.runFeeReminders(opts);

// Long-running host: schedules itself. Vercel: /api/cron/reminders calls runFeeReminders instead.
if (!process.env.VERCEL) {
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ [CRON] Daily fee reminder job triggered');
    try { await runFeeReminders(); } catch (err) { console.error('❌ [CRON] Fee reminder job failed:', err.message); }
  }, { timezone: 'Africa/Lagos' });
  console.log('✅ Fee reminder cron job registered (daily 08:00, Africa/Lagos)');
}

module.exports = { runFeeReminders };
