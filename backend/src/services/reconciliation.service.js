// src/services/reconciliation.service.js
// ─────────────────────────────────────────────────────────────────────────────
// THE CORE ENGINE.
// Every inbound payment — whether from a webhook or a sync job — flows through
// processPayment(). It is the single source of truth for reconciliation.
//
// Rules:
//   1. Idempotency first  — if reference already exists, skip silently
//   2. Atomic writes      — FeeAssignment + Payment saved in one session
//   3. Status resolution  — exact / underpayment / overpayment computed cleanly
//   4. Real-time emit     — Socket.io event fired after every successful write
//   5. Notification       — bursar + parent alerted after every payment
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const FeeAssignment = require('../models/FeeAssignment');
const Student = require('../models/Student');
const { emitReconciliationEvent } = require('../sockets/reconciliation.socket');
const { createPaymentNotifications } = require('./notification.service');

// ─── Status resolver ─────────────────────────────────────────────────────────
// Given expected amount and total paid so far, return the correct status.
const resolveStatus = (amountExpected, totalPaid) => {
  const balance = amountExpected - totalPaid;
  if (balance === 0)  return { status: 'paid',     reconciliationStatus: 'exact',        balance: 0,       overpayment: 0 };
  if (balance > 0)    return { status: 'partial',  reconciliationStatus: 'underpayment', balance,          overpayment: 0 };
                      return { status: 'overpaid', reconciliationStatus: 'overpayment',  balance: 0,       overpayment: Math.abs(balance) };
};

// ─── Main entry point ────────────────────────────────────────────────────────
/**
 * processPayment()
 *
 * Called by:
 *   - webhook.controller.js  (real-time, after Nomba fires a webhook)
 *   - transaction.service.js (batch sync, hourly cron job)
 *
 * @param {object} params
 * @param {string} params.accountNumber     - Virtual account that received the money
 * @param {number} params.amountPaid        - Amount received in NGN (not kobo)
 * @param {string} params.reference         - Nomba transaction reference (idempotency key)
 * @param {string} [params.narration]       - Transfer narration from payer
 * @param {string} [params.payerName]       - Payer account name
 * @param {string} [params.payerAccount]    - Payer account number
 * @param {string} [params.payerBank]       - Payer bank name
 * @param {string} params.source            - 'webhook' | 'sync' | 'manual'
 * @param {object} params.io                - Socket.io server instance
 * @returns {object} result
 */
const processPayment = async ({
  accountNumber,
  amountPaid,
  reference,
  narration       = null,
  payerName       = null,
  payerAccount    = null,
  payerBank       = null,
  source          = 'webhook',
  io              = null,
}) => {

  // ── Step 1: Idempotency check ─────────────────────────────────────────────
  // If we've already processed this reference, skip completely.
  // This handles: webhook retries, duplicate cron runs, race conditions.
  const existingPayment = await Payment.findOne({ reference });
  if (existingPayment) {
    console.log(`ℹ️  Payment ${reference} already processed. Skipping.`);
    return { skipped: true, reason: 'duplicate_reference', reference };
  }

  // ── Step 2: Look up student by virtual account number ─────────────────────
  const student = await Student.findOne({
    'virtualAccount.accountNumber': accountNumber,
    isActive: true,
  });

  if (!student) {
    console.warn(`⚠️  No student found for account number: ${accountNumber}`);
    return { skipped: true, reason: 'unknown_account', accountNumber };
  }

  // ── Step 3: Find the active (unpaid/partial) fee assignment ───────────────
  // Target the most recent open assignment. If a student has multiple open
  // terms, we apply to the oldest first (chronological order).
  const feeAssignment = await FeeAssignment.findOne({
    studentId: student._id,
    status: { $in: ['unpaid', 'partial'] },
  })
    .populate('feeStructureId', 'name term academicSession')
    .sort({ createdAt: 1 }); // oldest first

  if (!feeAssignment) {
    // Student has no open fees — could be an overpayment on a fully-paid account
    console.warn(`⚠️  No open fee assignment for student: ${student.studentId}`);
    return {
      skipped: true,
      reason:  'no_open_assignment',
      studentId: student._id,
      studentName: student.fullName,
      amountPaid,
      reference,
      note: 'Student has no outstanding fees. Payment flagged for manual review.',
    };
  }

  // ── Step 4: Compute reconciliation ───────────────────────────────────────
  const balanceBefore  = feeAssignment.balance;
  const totalNowPaid   = feeAssignment.totalPaid + amountPaid;
  const { status, reconciliationStatus, balance, overpayment } =
    resolveStatus(feeAssignment.amountExpected, totalNowPaid);

  // ── Step 5: Atomic write — Payment + FeeAssignment in one session ─────────
  // If either write fails, both are rolled back. No partial saves.
  const session = await mongoose.startSession();
  let savedPayment;

  try {
    await session.withTransaction(async () => {

      // 5a. Create the immutable payment record
      [savedPayment] = await Payment.create([{
        studentId:            student._id,
        schoolId:             student.schoolId,
        feeAssignmentId:      feeAssignment._id,
        amountPaid,
        currency:             'NGN',
        reference,
        narration,
        payerAccountName:     payerName,
        payerAccountNumber:   payerAccount,
        payerBankName:        payerBank,
        reconciliationStatus,
        balanceBefore,
        balanceAfter:         balance,
        overpaymentAmount:    overpayment,
        source,
        processedAt:          new Date(),
      }], { session });

      // 5b. Update the fee assignment running state
      await FeeAssignment.findByIdAndUpdate(
        feeAssignment._id,
        {
          $set: {
            totalPaid:     totalNowPaid,
            balance,
            overpayment,
            status,
            lastPaymentAt: new Date(),
          },
        },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  // ── Step 6: Build result payload ──────────────────────────────────────────
  const result = {
    skipped:              false,
    paymentId:            savedPayment._id,
    reference,
    studentId:            student._id,
    studentName:          student.fullName,
    studentCode:          student.studentId,
    class:                student.class,
    schoolId:             student.schoolId,
    feeAssignmentId:      feeAssignment._id,
    feeName:              feeAssignment.feeStructureId?.name,
    term:                 feeAssignment.feeStructureId?.term,
    academicSession:      feeAssignment.feeStructureId?.academicSession,
    amountPaid,
    amountExpected:       feeAssignment.amountExpected,
    totalPaid:            totalNowPaid,
    balanceBefore,
    balanceAfter:         balance,
    overpayment,
    status,
    reconciliationStatus,
    source,
    processedAt:          savedPayment.processedAt,
  };

  // ── Step 7: Emit real-time Socket.io event ────────────────────────────────
  if (io) {
    emitReconciliationEvent(io, student.schoolId.toString(), result);
  }

  // ── Step 8: Fire notifications (non-blocking) ─────────────────────────────
  createPaymentNotifications(result, student).catch((err) =>
    console.error('⚠️  Notification error (non-blocking):', err.message)
  );

  // ── Step 9: Log summary ───────────────────────────────────────────────────
  const icons = { exact: '✅', underpayment: '⚠️ ', overpayment: '🔁' };
  console.log(
    `${icons[reconciliationStatus]} [${reconciliationStatus.toUpperCase()}] ` +
    `${student.fullName} (${student.studentId}) | ` +
    `Paid: ₦${amountPaid.toLocaleString()} | ` +
    `Balance: ₦${balance.toLocaleString()} | ` +
    `Status: ${status} | ref: ${reference}`
  );

  return result;
};

// ─── Manual payment entry (bursar override) ───────────────────────────────────
/**
 * processManualPayment()
 * Allows a bursar to record a cash or cheque payment manually.
 * Uses the same reconciliation engine — treated as source: 'manual'.
 *
 * @param {object} params
 * @param {string} params.studentId       - MongoDB _id of student
 * @param {number} params.amountPaid
 * @param {string} params.reference       - Bursar-supplied reference
 * @param {string} [params.narration]
 * @param {object} params.io
 */
const processManualPayment = async ({
  studentId,
  amountPaid,
  reference,
  narration = 'Manual payment entry',
  io        = null,
}) => {
  const student = await Student.findById(studentId);
  if (!student) throw new Error('Student not found');
  if (!student.virtualAccount?.accountNumber) throw new Error('Student has no virtual account');

  return processPayment({
    accountNumber: student.virtualAccount.accountNumber,
    amountPaid,
    reference,
    narration,
    source: 'manual',
    io,
  });
};

// ─── Reconciliation summary for a single fee assignment ──────────────────────
/**
 * getReconciliationSummary()
 * Returns a detailed breakdown of all payments against an assignment.
 *
 * @param {string} feeAssignmentId
 */
const getReconciliationSummary = async (feeAssignmentId) => {
  const [assignment, payments] = await Promise.all([
    FeeAssignment.findById(feeAssignmentId)
      .populate('studentId',     'fullName studentId class virtualAccount')
      .populate('feeStructureId','name term academicSession amount dueDate'),
    Payment.find({ feeAssignmentId }).sort({ processedAt: 1 }),
  ]);

  if (!assignment) throw new Error('Fee assignment not found');

  return {
    assignment,
    payments,
    summary: {
      amountExpected: assignment.amountExpected,
      totalPaid:      assignment.totalPaid,
      balance:        assignment.balance,
      overpayment:    assignment.overpayment,
      status:         assignment.status,
      paymentCount:   payments.length,
      firstPaymentAt: payments[0]?.processedAt || null,
      lastPaymentAt:  payments[payments.length - 1]?.processedAt || null,
    },
  };
};

module.exports = {
  processPayment,
  processManualPayment,
  getReconciliationSummary,
};
