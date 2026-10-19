// src/services/reconciliation.service.js
const mongoose = require('mongoose');
const Payment       = require('../models/Payment');
const FeeAssignment = require('../models/FeeAssignment');
const Student       = require('../models/Student');
const { emitReconciliationEvent } = require('../sockets/reconciliation.socket');
const { createPaymentNotifications } = require('./notification.service');
const { resolvePlatformFee } = require('./platformFee.service');
const { checkEarlyPaymentDiscount } = require('./earlyPaymentDiscount.service');
const { checkReferralConversion } = require('./referral.service');

// ─── Resolve payment status ──────────────────────────────────────────────────
const resolveStatus = (amountExpected, totalPaid) => {
  const balance = amountExpected - totalPaid;
  if (balance === 0) return { status: 'paid',     reconciliationStatus: 'exact',        balance: 0,       overpayment: 0 };
  if (balance > 0)   return { status: 'partial',  reconciliationStatus: 'underpayment', balance,          overpayment: 0 };
                     return { status: 'overpaid', reconciliationStatus: 'overpayment',  balance: 0,       overpayment: Math.abs(balance) };
};

// ─── Atomic write with session fallback ──────────────────────────────────────
const atomicWrite = async (paymentData, assignmentId, assignmentUpdate) => {
  let savedPayment;
  try {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        [savedPayment] = await Payment.create([paymentData], { session });
        await FeeAssignment.findByIdAndUpdate(assignmentId, { $set: assignmentUpdate }, { session });
      });
    } finally { await session.endSession(); }
  } catch (sessionErr) {
    if (!(sessionErr.message?.includes('Transaction') || sessionErr.message?.includes('replica'))) throw sessionErr;
    console.warn('⚠️  Replica set not available — using sequential writes (dev mode)');
    savedPayment = await Payment.create(paymentData);
    await FeeAssignment.findByIdAndUpdate(assignmentId, { $set: assignmentUpdate });
  }

  // Referral rewards are idempotent and never apply to cash entries
  if (paymentData.source !== 'manual') await checkReferralConversion(paymentData.schoolId, null);
  return savedPayment;
};

// ─── Main reconciliation entry point ─────────────────────────────────────────
const processPayment = async ({
  accountNumber = null,
  studentId = null,
  amountPaid,
  reference,
  narration     = null,
  payerName     = null,
  payerAccount  = null,
  payerBank     = null,
  payerBankCode = null,
  gatewayFee    = 0, 
  source        = 'webhook',
  io            = null,
}) => {
  // 1. Idempotency
  const existing = await Payment.findOne({ reference });
  if (existing) {
    console.log(`ℹ️  Payment ${reference} already processed. Skipping.`);
    return { skipped: true, reason: 'duplicate_reference', reference };
  }

  

  // 2. Find student by virtual account (either gateway) and note which one matched
  // 2. Find the student
let student, gateway;
if (source === 'manual') {
  student = studentId ? await Student.findOne({ _id: studentId, isActive: true }) : null;
  if (!student) return { skipped: true, reason: 'unknown_student', studentId };
  gateway = 'manual';
} else {
  student = await Student.findOne({
    isActive: true,
    $or: [
      { 'virtualAccounts.nomba.accountNumber': accountNumber },
      { 'virtualAccounts.paystack.accountNumber': accountNumber },
    ],
  });
  if (!student) {
    console.warn(`⚠️  No student found for account: ${accountNumber}`);
    return { skipped: true, reason: 'unknown_account', accountNumber };
  }
  gateway = student.virtualAccounts?.nomba?.accountNumber === accountNumber ? 'nomba' : 'paystack';
}
  // 3. Oldest open fee assignment
  const feeAssignment = await FeeAssignment.findOne({
    studentId: student._id,
    status:    { $in: ['unpaid', 'partial'] },
  })
    .populate('feeStructureId', 'name term academicSession dueDate')
    .sort({ createdAt: 1 });

  if (!feeAssignment) {
    console.warn(`⚠️  No open fee assignment for student: ${student.studentId}`);
    return {
      skipped: true, reason: 'no_open_assignment',
      studentId: student._id, studentName: student.fullName, amountPaid, reference,
    };
  }

  // 4. Platform fee comes off the real transfer first. Only the remainder
  //    counts toward the school fee. Manual (cash) entries carry no fee,
  //    since no gateway touched that money.
  const balanceBefore = feeAssignment.balance;
  const { platformFee, netAmountForSchool, waived } = source === 'manual'
    ? { platformFee: 0, netAmountForSchool: amountPaid, waived: false }
    : await resolvePlatformFee({ amountPaid, gateway, schoolId: student.schoolId });

  const totalNowPaid = feeAssignment.totalPaid + netAmountForSchool;

  // 4a. Early full-payment discount (checked against what the school actually nets)
  const discount = checkEarlyPaymentDiscount(feeAssignment, netAmountForSchool);

  let status, reconciliationStatus, balance, overpayment;
  if (discount.qualifies) {
    status = 'paid'; reconciliationStatus = 'exact'; balance = 0; overpayment = 0;
  } else {
    ({ status, reconciliationStatus, balance, overpayment } =
      resolveStatus(feeAssignment.amountExpected, totalNowPaid));
  }

  // 5. Atomic write
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
    payerBankCode,
    reconciliationStatus,
    balanceBefore,
    balanceAfter:       balance,
    overpaymentAmount:  overpayment,
    source,
    processedAt:        new Date(),
    gateway,
    platformFee,
    platformFeeWaived:  waived,
    netAmountForSchool,
    gatewayFee: source === 'manual' ? 0 : (Number(gatewayFee) || 0),
    earlyPaymentDiscountApplied: discount.qualifies,
    earlyPaymentDiscountAmount:  discount.discountAmount,
  };

  const assignmentUpdate = {
    totalPaid:     totalNowPaid,
    balance,
    overpayment,
    status,
    lastPaymentAt: new Date(),
    ...(discount.qualifies && { discountApplied: true, discountAmount: discount.discountAmount }),
  };

  const savedPayment = await Write(paymentData, feeAssignment._id, assignmentUpdate);

  // 6. Result
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
    gateway,
    platformFee,
    platformFeeWaived:    waived,
    netAmountForSchool,
    earlyPaymentDiscountApplied: discount.qualifies,
    earlyPaymentDiscountAmount:  discount.discountAmount,
  };

  // 7. Real-time event
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
    `Paid: ₦${amountPaid.toLocaleString()} | Fee: ₦${platformFee.toLocaleString()} | ` +
    `Balance: ₦${balance.toLocaleString()} | Status: ${status} | ref: ${reference}`
  );

  return result;
};

// ─── Manual payment (bursar override) ────────────────────────────────────────
const processManualPayment = ({ studentId, amountPaid, reference, narration = 'Manual payment entry', io = null }) =>
  processPayment({ studentId, amountPaid, reference, narration, source: 'manual', io });  

const student = await Student.findById(studentId);
  if (!student) throw new Error('Student not found');

  const resolvedGateway = gateway
    || (student.virtualAccounts?.nomba?.accountNumber && 'nomba')
    || (student.virtualAccounts?.paystack?.accountNumber && 'paystack');

  if (!resolvedGateway) throw new Error('Student has no virtual account on either gateway');

  const accountNumber = student.virtualAccounts[resolvedGateway].accountNumber;
  return processPayment({ accountNumber, amountPaid, reference, narration, source: 'manual', io });

// ─── Reconciliation summary for one assignment ────────────────────────────────
const getReconciliationSummary = async (feeAssignmentId) => {
  const [assignment, payments] = await Promise.all([
    FeeAssignment.findById(feeAssignmentId)
      .populate('studentId', 'fullName studentId class virtualAccounts')
     .populate('feeStructureId', 'name term academicSession dueDate studentOnly'),
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

module.exports = { processPayment, processManualPayment, getReconciliationSummary };