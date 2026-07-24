// src/services/transaction.service.js
// Safety net for missed webhooks. Runs hourly via cron.
// Uses getAllTransactions (verified Nomba endpoint).

const { getAllTransactions, filterTransactions } = require('./nomba.service');
const { processPayment } = require('./reconciliation.service');
const Payment = require('../models/Payment');
const Student = require('../models/Student');

let lastSyncTime = null;

// ─── Full sync: all sub-account transactions in a time window ─────────────────
const syncTransactions = async (io = null) => {
  const startTime = Date.now();
  const syncFrom  = lastSyncTime
    ? new Date(lastSyncTime).toISOString()
    : new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const syncTo    = new Date().toISOString();

  console.log(`\n🔄 Transaction sync started | window: ${syncFrom} → ${syncTo}`);

  let processed = 0, skipped = 0, errors = 0, page = 1, hasMore = true;

  while (hasMore) {
    let transactions;
    try {
      const response = await getAllTransactions({ from: syncFrom, to: syncTo, page, limit: 100 });
      // Nomba returns transactions in response.transactions or response.data
      transactions   = response?.transactions || response?.data || [];
      const total    = response?.totalCount    || response?.total || 0;
      hasMore        = transactions.length === 100 && page * 100 < total;
      page++;
    } catch (fetchErr) {
      console.error(`❌ Sync fetch error (page ${page}):`, fetchErr.message);
      break;
    }

    if (!transactions.length) { hasMore = false; break; }

    for (const txn of transactions) {
      // Nomba transaction fields (verified from their API)
      const accountNumber = txn.destinationAccountNumber
                         || txn.accountNumber
                         || txn.virtualAccountNumber;
      const amountPaid    = parseFloat(txn.amount || txn.transactionAmount || 0);
      const reference     = txn.reference || txn.transactionReference || txn.sessionId;

      if (!accountNumber || !amountPaid || !reference) { skipped++; continue; }

      // Only process credit/inflow transactions
      const txnType = (txn.type || txn.transactionType || '').toLowerCase();
      if (txnType && !txnType.includes('credit') && txnType !== 'inflow') { skipped++; continue; }

      try {
        const result = await processPayment({
          accountNumber,
          amountPaid,
          reference,
          narration:    txn.narration    || txn.description    || null,
          payerName:    txn.sourceAccountName || txn.senderName || null,
          payerAccount: txn.sourceAccountNumber              || null,
          payerBank:    txn.sourceBankName  || txn.senderBank || null,
          source:       'sync',
          io,
        });
        result.skipped ? skipped++ : processed++;
        if (!result.skipped) console.log(`  ↳ Caught by sync: ${reference} | ₦${amountPaid.toLocaleString()}`);
      } catch (procErr) {
        errors++;
        console.error(`  ❌ Failed to process ${reference}:`, procErr.message);
      }
    }
  }

  lastSyncTime = syncTo;
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ Sync complete | processed: ${processed} | skipped: ${skipped} | errors: ${errors} | duration: ${duration}s\n`);
  return { processed, skipped, errors, duration: `${duration}s`, syncFrom, syncTo };
};

// ─── Targeted sync: one student's virtual account ────────────────────────────
const syncStudentTransactions = async (studentId, io = null) => {
  const student = await Student.findById(studentId);
  if (!student)                           throw new Error('Student not found');
  if (!student.virtualAccount?.accountNumber) throw new Error('Student has no virtual account');

  const accountNumber = student.virtualAccount.accountNumber;
  const from          = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  console.log(`🔄 Syncing transactions for student ${student.studentId} (${accountNumber})`);

  let processed = 0, skipped = 0;

  try {
    // Use filterTransactions to scope to this specific account
    const response     = await filterTransactions({ accountNumber, from, limit: 100 });
    const transactions = response?.transactions || response?.data || [];

    for (const txn of transactions) {
      const reference  = txn.reference || txn.transactionReference || txn.sessionId;
      const amountPaid = parseFloat(txn.amount || 0);
      if (!reference || !amountPaid) { skipped++; continue; }

      const result = await processPayment({
        accountNumber,
        amountPaid,
        reference,
        narration:    txn.narration || null,
        payerName:    txn.sourceAccountName || null,
        payerAccount: txn.sourceAccountNumber || null,
        payerBank:    txn.sourceBankName || null,
        source:       'sync',
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

const getLastSyncTime = () => lastSyncTime;

module.exports = { syncTransactions, syncStudentTransactions, getLastSyncTime };