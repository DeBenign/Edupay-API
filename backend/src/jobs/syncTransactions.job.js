// src/jobs/syncTransactions.job.js
// Hourly cron: syncs Nomba transactions to catch any payments missed by webhooks.

const cron = require('node-cron');
const { syncTransactions } = require('../services/transaction.service');

// Run every hour at minute 0
// '0 * * * *' = at XX:00 every hour
cron.schedule('0 * * * *', async () => {
  console.log('⏰ [CRON] Hourly transaction sync triggered');
  try {
    // io is not available in the cron context directly
    // Real-time emit will be skipped; DB will be updated correctly
    await syncTransactions(null);
  } catch (err) {
    console.error('❌ [CRON] Sync job failed:', err.message);
  }
}, {
  timezone: 'Africa/Lagos',
});

console.log('✅ Transaction sync cron job registered (hourly, Africa/Lagos)');
