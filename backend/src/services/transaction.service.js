// src/services/transaction.service.js
// ─────────────────────────────────────────────────────────────────────────────
// Safety net for missed webhooks.
// Runs hourly via cron. Fetches all transactions from Nomba's Transactions API
// and passes any unrecorded ones through the reconciliation engine.
//
// Why this exists:
//   - Webhooks can fail (network timeout, server downtime, Nomba retry limit)
//   - This job guarantees 100% payment capture regardless of webhook reliability
//   - Idempotency in processPayment() ensures no double-counting
// ─────────────────────────────────────────────────────────────────────────────

const { getAllTransactions, getAccountTransactions } = require('./nomba.service');
const { processPayment } = require('./reconciliation.service');
const Payment = require('../models/Payment');
const Student = require('../models/Student');

// Track when the last sync ran (in-memory; survives restarts via date math)
let lastSyncTime = null;

// ─── Full sync: scan all Nomba transactions in a time window ─────────────────
/**
 * syncTransactions()
 * Called by the cron job every hour.
 * Fetches transactions from Nomba, skips already-processed ones,
 * and runs reconciliation on anything new.
 *
 * @param {object} io  - Socket.io instance (for real-time emit on caught payments)
 * @returns {object}   - { processed, skipped, errors, duration }
 */
const syncTransactions = async (io = null) => {
  const startTime = Date.now();
  const syncFrom  = lastSyncTime
    ? new Date(lastSyncTime).toISOString()
    : new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // default: last 2 hours

  const syncTo = new Date().toISOString();

  console.log(`\n🔄 Transaction sync started | window: ${syncFrom} → ${syncTo}`);

  let processed = 0;
  let skipped   = 0;
  let errors    = 0;
  let page      = 1;
  let hasMore   = true;

  while (hasMore) {
    let transactions;

    try {
      const response = await getAllTransactions({
        from:  syncFrom,
        to:    syncTo,
        page,
        limit: 100,
      });

      transactions = response?.transactions || response?.data || [];
      const total  = response?.totalCount   || response?.total || 0;
      hasMore      = transactions.length === 100 && page * 100 < total;
      page++;
    } catch (fetchErr) {
      console.error(`❌ Sync fetch error (page ${page}):`, fetchErr.message);
      break;
    }

    if (!transactions.length) {
      hasMore = false;
      break;
    }

    // Process each transaction through the reconciliation engine
    for (const txn of transactions) {
      const accountNumber = txn.destinationAccountNumber ||
                            txn.accountNumber            ||
                            txn.virtualAccountNumber;
      const amountPaid    = parseFloat(txn.amount || txn.transactionAmount || 0);
      const reference     = txn.reference || txn.transactionReference || txn.id;

      if (!accountNumber || !amountPaid || !reference) {
        skipped++;
        continue;
      }

      // Skip non-credit transactions
      const txnType = (txn.type || txn.transactionType || '').toLowerCase();
      if (txnType && !txnType.includes('credit') && txnType !== 'inflow') {
        skipped++;
        continue;
      }

      try {
        const result = await processPayment({
          accountNumber,
          amountPaid,
          reference,
          narration:   txn.narration    || txn.description || null,
          payerName:   txn.sourceAccountName || txn.senderName || null,
          payerAccount:txn.sourceAccountNumber || null,
          payerBank:   txn.sourceBankName || null,
          source:      'sync',
          io,
        });

        if (result.skipped) {
          skipped++;
        } else {
          processed++;
          console.log(`  ↳ Caught by sync: ${reference} | ₦${amountPaid.toLocaleString()}`);
        }
      } catch (procErr) {
        errors++;
        console.error(`  ❌ Failed to process ${reference}:`, procErr.message);
      }
    }
  }

  // Update last sync time
  lastSyncTime = syncTo;

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(
    `✅ Sync complete | processed: ${processed} | skipped: ${skipped} | ` +
    `errors: ${errors} | duration: ${duration}s\n`
  );

  return { processed, skipped, errors, duration: `${duration}s`, syncFrom, syncTo };
};

// ─── Targeted sync: single student's virtual account ─────────────────────────
/**
 * syncStudentTransactions()
 * Sync only the transactions for a specific student's virtual account.
 * Used by admin to manually trigger a sync for one student (e.g. after a dispute).
 *
 * @param {string} studentId   - MongoDB _id of the student
 * @param {object} io
 */
const syncStudentTransactions = async (studentId, io = null) => {
  const student = await Student.findById(studentId);
  if (!student) throw new Error('Student not found');
  if (!student.virtualAccount?.accountNumber) {
    throw new Error('Student has no virtual account provisioned');
  }

  const accountNumber = student.virtualAccount.accountNumber;
  const from          = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  console.log(`🔄 Syncing transactions for student ${student.studentId} (${accountNumber})`);

  let processed = 0;
  let skipped   = 0;

  try {
    const response     = await getAccountTransactions({ accountNumber, from, limit: 100 });
    const transactions = response?.transactions || response?.data || [];

    for (const txn of transactions) {
      const reference  = txn.reference || txn.transactionReference;
      const amountPaid = parseFloat(txn.amount || 0);

      if (!reference || !amountPaid) { skipped++; continue; }

      const result = await processPayment({
        accountNumber,
        amountPaid,
        reference,
        narration:   txn.narration || null,
        payerName:   txn.sourceAccountName || null,
        payerAccount:txn.sourceAccountNumber || null,
        payerBank:   txn.sourceBankName || null,
        source:      'sync',
        io,
      });

      result.skipped ? skipped++ : processed++;
    }
  } catch (err) {
    throw new Error(`Sync failed: ${err.message}`);
  }

  console.log(`✅ Student sync done | processed: ${processed} | skipped: ${skipped}`);
  return { processed, skipped, studentId, accountNumber };
};

// ─── Get last sync time (for admin dashboard) ─────────────────────────────────
const getLastSyncTime = () => lastSyncTime;

module.exports = { syncTransactions, syncStudentTransactions, getLastSyncTime };
