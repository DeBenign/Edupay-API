// src/routes/cron.routes.js
// Scheduled jobs as HTTP endpoints, for hosts without a long-running process (Vercel).
// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically when CRON_SECRET is set.
// An external pinger (e.g. cron-job.org) can use the same header for more frequent runs.
const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();

const verifyCron = (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ success: false, message: 'CRON_SECRET is not configured' });
  const given = Buffer.from((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  const want  = Buffer.from(secret);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

const run = (name, loader) => async (req, res) => {
  try {
    await loader()();
    return res.json({ success: true, job: name, ranAt: new Date().toISOString() });
  } catch (err) {
    console.error(`❌ [CRON] ${name} failed:`, err.message);
    return res.status(500).json({ success: false, job: name, message: err.message });
  }
};

router.get('/sync',      verifyCron, run('sync',      () => require('../jobs/syncTransactions.job').runSync));
// Daily: reminders, plus the safety nets (retry queued emails, provision accounts that are still missing)
router.get('/reminders', verifyCron, run('reminders', () => async () => {
  await require('../jobs/feeReminder.job').runFeeReminders();
  await require('../jobs/subscriptionReminder.job').runSubscriptionReminders();
  await require('../services/outbox.service').flushOutbox();
  await require('../services/provisionBackfill.service').runProvisioningBackfill({ limit: 10, budgetMs: 15000 });
}));
// Safe to call as often as you like (every 5 to 15 minutes from an external pinger)
router.get('/emails',    verifyCron, run('emails',    () => () => require('../services/outbox.service').flushOutbox()));
router.get('/provision', verifyCron, run('provision', () => () => require('../services/provisionBackfill.service').runProvisioningBackfill()));
router.get('/vtu',       verifyCron, run('vtu',       () => require('../jobs/vtuVerify.job').runVtuVerify));

module.exports = router;
