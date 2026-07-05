// src/services/reconciliation.service.js
// Core reconciliation engine.
// Uses atomic writes via MongoDB sessions when replica set is available,
// falls back to sequential writes on standalone MongoDB (local dev).

const mongoose = require('mongoose');
const Payment       = require('../models/Payment');
const FeeAssignment = require('../models/FeeAssignment');
const Student       = require('../models/Student');
const { emitReconciliationEvent } = require('../sockets/reconciliation.socket');
const { createPaymentNotifications } = require('./notification.service');

// ─── Resolve payment status ──────────────────────────────────────────────────
const resolveStatus = (amountExpected, totalPaid) => {
  const balance = amountExpected - totalPaid;
  if (balance === 0)  return { status: 'paid',     reconciliationStatus: 'exact',        balance: 0,               overpayment: 0               };
  if (balance > 0)    return { status: 'partial',  reconciliationStatus: 'underpayment', balance,                  overpayment: 0               };
                      return { status: 'overpaid', reconciliationStatus: 'overpayment',  balance: 0,               overpayment: Math.abs(balance) };
};

// ─── Atomic write with session fallback ──────────────────────────────────────
// MongoDB standalone (local dev) does not support transactions.
// Atlas M0 (free) does — so production works fully atomically.
const atomicWrite = async (paymentData, assignmentId, assignmentUpdate) => {
  try {
    const session = await mongoose.startSession();
    let savedPayment;
    await session.withTransaction(async () => {
      [savedPayment] = await Payment.create([paymentData], { session });
      await FeeAssignment.findByIdAndUpdate(assignmentId, { $set: assignmentUpdate }, { session });
    });
    await session.endSession();
    return savedPayment;
  } catch (sessionErr) {
    // Fallback: sequential writes (local standalone MongoDB)
    if (sessionErr.message?.includes('Transaction') || sessionErr.message?.includes('replica')) {
      console.warn('⚠️  Replica set not available — using sequential writes (dev mode)');
      const savedPayment = await Payment.create(paymentData);
      await FeeAssignment.findByIdAndUpdate(assignmentId, { $set: assignmentUpdate });
      return savedPayment;
    }
    throw sessionErr;
  }
};

// ─── Main reconciliation entry point ─────────────────────────────────────────
const processPayment = async ({
  accountNumber,
  amountPaid,
  reference,
  narration    = null,
  payerName    = null,
  payerAccount = null,
  payerBank    = null,
  source       = 'webhook',
  io           = null,
}) => {
  // 1. Idempotency — skip if already processed
  const existing = await Payment.findOne({ reference });
  if (existing) {
    console.log(`ℹ️  Payment ${reference} already processed. Skipping.`);
    return { skipped: true, reason: 'duplicate_reference', reference };
  }

  // 2. Find student by virtual account number
  const student = await Student.findOne({
    'virtualAccount.accountNumber': accountNumber,
    isActive: true,
  });
  if (!student) {
    console.warn(`⚠️  No student found for account: ${accountNumber}`);
    return { skipped: true, reason: 'unknown_account', accountNumber };
  }

  // 3. Find oldest open fee assignment
  const feeAssignment = await FeeAssignment.findOne({
    studentId: student._id,
    status:    { $in: ['unpaid', 'partial'] },
  })
    .populate('feeStructureId', 'name term academicSession')
    .sort({ createdAt: 1 });

  if (!feeAssignment) {
    console.warn(`⚠️  No open fee assignment for student: ${student.studentId}`);
    return {
      skipped:     true,
      reason:      'no_open_assignment',
      studentId:   student._id,
      studentName: student.fullName,
      amountPaid,
      reference,
    };
  }

  // 4. Compute reconciliation
  const balanceBefore = feeAssignment.balance;
  const totalNowPaid  = feeAssignment.totalPaid + amountPaid;
  const { status, reconciliationStatus, balance, overpayment } =
    resolveStatus(feeAssignment.amountExpected, totalNowPaid);

  // 5. Atomic write (with replica set fallback)
  const paymentData = {
    studentId:          student._id,
    schoolId:           student.schoolId,
    feeAssignmentId:    feeAssignment._id,
    amountPaid,
    currency:           'NGN',
    reference,
    narration,
    payerAccountName:   payerName,
    payerAccountNumber: payerAccount,
    payerBankName:      payerBank,
    reconciliationStatus,
    balanceBefore,
    balanceAfter:       balance,
    overpaymentAmount:  overpayment,
    source,
    processedAt:        new Date(),
  };

  const assignmentUpdate = {
    totalPaid:     totalNowPaid,
    balance,
    overpayment,
    status,
    lastPaymentAt: new Date(),
  };

  const savedPayment = await atomicWrite(paymentData, feeAssignment._id, assignmentUpdate);

  // 6. Build result
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

  // 7. Real-time Socket.io event
  if (io) emitReconciliationEvent(io, student.schoolId.toString(), result);

  // 8. Notifications (non-blocking)
  createPaymentNotifications(result, student).catch((err) =>
    console.error('⚠️  Notification error:', err.message)
  );

  // 9. Log
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

// ─── Manual payment (bursar override) ────────────────────────────────────────
const processManualPayment = async ({ studentId, amountPaid, reference, narration = 'Manual payment entry', io = null }) => {
  const student = await Student.findById(studentId);
  if (!student)                           throw new Error('Student not found');
  if (!student.virtualAccount?.accountNumber) throw new Error('Student has no virtual account');
  return processPayment({
    accountNumber: student.virtualAccount.accountNumber,
    amountPaid, reference, narration, source: 'manual', io,
  });
};

// ─── Reconciliation summary for one assignment ────────────────────────────────
const getReconciliationSummary = async (feeAssignmentId) => {
  const [assignment, payments] = await Promise.all([
    FeeAssignment.findById(feeAssignmentId)
      .populate('studentId',      'fullName studentId class virtualAccount')
      .populate('feeStructureId', 'name term academicSession amount dueDate'),
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
      firstPaymentAt: payments[0]?.processedAt     || null,
      lastPaymentAt:  payments[payments.length-1]?.processedAt || null,
    },
  };
};

module.exports = { processPayment, processManualPayment, getReconciliationSummary };
