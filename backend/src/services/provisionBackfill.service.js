// src/services/provisionBackfill.service.js
// Gives virtual accounts to active students who have none, a few at a time.
// Needed on serverless hosts, where the in-memory background queue is cut off when the response is sent.
// Run it from /api/cron/provision (every few minutes from an external pinger) and as a daily safety net.
const Student = require('../models/Student');
const virtualAccounts = require('./virtualAccount.service');

const runProvisioningBackfill = async ({ limit = 15, budgetMs = 20000, delayMs } = {}) => {
  const pause = delayMs ?? (process.env.BULK_PROVISION_DELAY_MS === undefined ? 1500 : Number(process.env.BULK_PROVISION_DELAY_MS) || 0);
  const started = Date.now();
  const students = await Student.find({
    isActive: true,
    'virtualAccounts.nomba.accountNumber': null,       // null matches missing
    'virtualAccounts.paystack.accountNumber': null,
  }).sort({ createdAt: 1 }).limit(limit);

  const out = { attempted: 0, provisioned: 0, failed: 0 };
  for (const student of students) {
    if (Date.now() - started > budgetMs) break;       // stay inside the function's time limit
    out.attempted++;
    try {
      const { errors } = await virtualAccounts.provisionStudentVirtualAccount(student);
      if ((errors || []).length >= 2) { out.failed++; console.warn(`⚠️  Backfill ${student.studentId}: ${errors.join('; ')}`); }
      else out.provisioned++;
    } catch (err) { out.failed++; console.error(`❌ Backfill ${student.studentId} failed:`, err.message); }
    if (pause) await new Promise((r) => setTimeout(r, pause));
  }
  return out;
};

module.exports = { runProvisioningBackfill };
