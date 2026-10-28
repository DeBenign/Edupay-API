// src/jobs/syncTransactions.job.js
// Hourly sync of Nomba transactions to catch payments missed by webhooks.
// Long-running host: schedules itself. Vercel: /api/cron/sync calls runSync instead.
const cron = require('node-cron');
const { syncTransactions } = require('../services/transaction.service');

// io is not available in the cron context; the DB is still updated correctly
const runSync = () => syncTransactions(null);

if (!process.env.VERCEL) {
  cron.schedule('0 * * * *', async () => {
    console.log('⏰ [CRON] Hourly transaction sync triggered');
    try { await runSync(); } catch (err) { console.error('❌ [CRON] Sync job failed:', err.message); }
  }, { timezone: 'Africa/Lagos' });
  console.log('✅ Transaction sync cron job registered (hourly, Africa/Lagos)');
}

module.exports = { runSync };
