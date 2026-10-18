// src/controllers/payment.controller.js
const Payment = require('../models/Payment');
const FeeAssignment = require('../models/FeeAssignment');
const Student = require('../models/Student');
const paystackService = require('../services/paystack.service');
const nombaService = require('../services/nomba.service');
 const { getOrCreateNextTermAssignment } = require('../services/fee.service');
const { processManualPayment, getReconciliationSummary } = require('../services/reconciliation.service');
const { syncStudentTransactions } = require('../services/transaction.service');
const { success, created, badRequest, notFound, error, forbidden } = require('../utils/apiResponse');
const { paginate } = require('../utils/paginate');

// ─── Access helpers ──────────────────────────────────────────────────────────
// Parents may only touch their own child; staff only students of their school.
const checkStudentAccess = async (req, studentId) => {
  const student = await Student.findById(studentId).select('schoolId parentId');
  if (!student) return { code: 'notFound' };
  const allowed = req.user.role === 'parent'
    ? student.parentId?.toString() === req.user._id.toString()
    : student.schoolId.toString() === req.user.schoolId?.toString();
  return allowed ? { student } : { code: 'forbidden' };
};
const denyAccess = (res, code) =>
  code === 'notFound' ? notFound(res, 'Student not found') : forbidden(res, 'Access denied');

// ─── Bank code resolution (exact normalized name match only; never guess on money) ──
const normalizeBankName = (n = '') =>
  n.toLowerCase().replace(/\b(plc|bank|limited|ltd|nigeria)\b/g, '').replace(/[^a-z0-9]/g, '');

const resolveBankCode = async (payment) => {
  if (payment.payerBankCode) return payment.payerBankCode;
  if (!payment.payerBankName) return null;
  const raw = payment.gateway === 'paystack'
    ? await paystackService.listBanks()
    : await nombaService.getBankList();
  const banks = Array.isArray(raw) ? raw : (raw?.results || raw?.banks || raw?.data || []);
  const target = normalizeBankName(payment.payerBankName);
  if (!target) return null;
  const match = banks.find((b) => normalizeBankName(b.name || b.bankName) === target);
  return match?.code || match?.bankCode || null;
};

// Atomic state change: only succeeds if the assignment is still in the `from` state
const claimResolution = (id, from, to) =>
  FeeAssignment.findOneAndUpdate(
    { _id: id, status: 'overpaid', overpaymentResolution: from },
    { $set: { overpaymentResolution: to } },
    { new: true }
  );

// POST /api/payments/manual — bursar records a cash/cheque payment
const createManualPayment = async (req, res) => {
  try {
    if (req.user.role === 'parent') return forbidden(res, 'Access denied');

    const { studentId, reference, narration, gateway } = req.body;
    const amountPaid = Number(req.body.amountPaid);
    if (!studentId || !reference || !Number.isFinite(amountPaid)) {
      return badRequest(res, 'studentId, amountPaid, and reference are required');
    }
    if (amountPaid <= 0) return badRequest(res, 'amountPaid must be greater than 0');
    if (gateway && !['nomba', 'paystack'].includes(gateway)) {
      return badRequest(res, "gateway must be 'nomba' or 'paystack' if provided");
    }

    const access = await checkStudentAccess(req, studentId);
    if (access.code) return denyAccess(res, access.code);

    const io = req.app.locals.io || null;
    const result = await processManualPayment({ studentId, amountPaid, reference, narration, gateway, io });

    if (result.skipped) return badRequest(res, `Payment skipped: ${result.reason}`);
    return created(res, { result }, 'Manual payment recorded successfully');
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/payments/student/:studentId — full payment history
const getStudentPayments = async (req, res) => {
  try {
    const access = await checkStudentAccess(req, req.params.studentId);
    if (access.code) return denyAccess(res, access.code);

    const { skip, limit, buildPagination } = paginate(req.query);
    const filter = { studentId: req.params.studentId };

    const [payments, totalCount] = await Promise.all([
      Payment.find(filter)
        .populate('feeAssignmentId', 'feeStructureId')
        .sort({ processedAt: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: { payments },
      pagination: buildPagination(totalCount),
    });
  } catch (err) {
    return error(res);
  }
};

// GET /api/payments/assignment/:id — reconciliation summary for one assignment
const getAssignmentSummary = async (req, res) => {
  try {
    const assignment = await FeeAssignment.findById(req.params.id).select('studentId');
    if (!assignment) return notFound(res, 'Fee assignment not found');
    const access = await checkStudentAccess(req, assignment.studentId);
    if (access.code) return denyAccess(res, access.code);

    const summary = await getReconciliationSummary(req.params.id);
    return success(res, summary);
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/payments/sync/:studentId — trigger a manual sync for one student
const triggerStudentSync = async (req, res) => {
  try {
    if (req.user.role === 'parent') return forbidden(res, 'Access denied');
    const access = await checkStudentAccess(req, req.params.studentId);
    if (access.code) return denyAccess(res, access.code);

    const io     = req.app.locals.io || null;
    const result = await syncStudentTransactions(req.params.studentId, io);
    return success(res, result, `Sync complete. Processed: ${result.processed}, Skipped: ${result.skipped}`);
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/payments/overpayments/:feeAssignmentId/resolve — parent (or staff) chooses
const resolveOverpayment = async (req, res) => {
  try {
    const assignment = await FeeAssignment.findById(req.params.feeAssignmentId);
    if (!assignment) return badRequest(res, 'Fee assignment not found');

    const access = await checkStudentAccess(req, assignment.studentId);
    if (access.code) return denyAccess(res, access.code);

    if (assignment.status !== 'overpaid') return badRequest(res, 'No overpayment on this assignment');
    if (assignment.overpaymentResolution !== 'pending') return badRequest(res, 'Overpayment already resolved');

    const { choice } = req.body; // 'refund' | 'credit_next_term'

    if (choice === 'refund') {
      const claimed = await claimResolution(assignment._id, 'pending', 'refund_requested');
      if (!claimed) return badRequest(res, 'Overpayment already resolved');
      return success(res, { assignment: claimed }, 'Refund requested — awaiting bursar approval');
    }

    if (choice === 'credit_next_term') {
      const claimed = await claimResolution(assignment._id, 'pending', 'credited_next_term');
      if (!claimed) return badRequest(res, 'Overpayment already resolved');

      try {
        const next = await getOrCreateNextTermAssignment(assignment.studentId, assignment);
        if (['paid', 'overpaid'].includes(next.status)) throw new Error("Next term's fee is already settled. Choose refund instead.");

        const applied  = Math.min(assignment.overpayment, next.amountExpected);
        const leftover = assignment.overpayment - applied;

        next.amountExpected = next.amountExpected - applied;
        next.balance        = Math.max(next.amountExpected - next.totalPaid, 0);
        if (next.balance === 0) next.status = 'paid';
        await next.save();

        // Any credit that didn't fit stays pending so it can still be refunded
        const updated = await FeeAssignment.findByIdAndUpdate(
          assignment._id,
          { $set: { overpayment: leftover, overpaymentResolution: leftover > 0 ? 'pending' : 'credited_next_term' } },
          { new: true }
        );
        return success(res, { assignment: updated, applied, leftover },
          leftover > 0 ? `₦${applied} credited; ₦${leftover} still unresolved` : 'Credited to next term');
      } catch (err) {
        await FeeAssignment.findByIdAndUpdate(assignment._id, { $set: { overpaymentResolution: 'pending' } });
        throw err;
      }
    }

    return badRequest(res, "choice must be 'refund' or 'credit_next_term'");
  } catch (err) { return error(res, err.message); }
};

// POST /api/payments/overpayments/:feeAssignmentId/approve-refund — bursar/admin only
// Optional body { bankCode } lets staff supply the code manually when it can't be resolved.
const approveRefund = async (req, res) => {
  try {
    const assignment = await FeeAssignment.findById(req.params.feeAssignmentId);
    if (!assignment || assignment.overpaymentResolution !== 'refund_requested') {
      return badRequest(res, 'No pending refund for this assignment');
    }
    if (assignment.schoolId.toString() !== req.user.schoolId?.toString()) return forbidden(res, 'Access denied');

    const payment = await Payment.findOne({
      feeAssignmentId: assignment._id,
      reconciliationStatus: 'overpayment',
    }).sort({ processedAt: -1 });

    if (!payment?.payerAccountNumber) {
      return badRequest(res, 'No payer account details on file for this payment — cannot refund');
    }

    const bankCode = req.body?.bankCode || await resolveBankCode(payment);
    if (!bankCode) {
      return badRequest(res, 'Could not resolve payer bank code — resend with { "bankCode": "..." }');
    }

    // Claim first so a double-click cannot send the money twice
    const claimed = await claimResolution(assignment._id, 'refund_requested', 'refunded');
    if (!claimed) return badRequest(res, 'Refund already processed or in progress');

    const reference = `refund-${assignment._id}`; // deterministic: the gateway also rejects duplicates
    try {
      let transfer;
      if (payment.gateway === 'paystack') {
        const recipient = await paystackService.createTransferRecipient({
          accountNumber: payment.payerAccountNumber,
          bankCode,
          accountName: payment.payerAccountName || 'EduPay Refund',
        });
        transfer = await paystackService.initiateTransfer({
          recipientCode: recipient.recipient_code,
          amount: assignment.overpayment,
          reason: 'EduPay fee overpayment refund',
          reference,
        });
      } else {
        transfer = await nombaService.initiateTransfer({
          amount: assignment.overpayment,
          destinationAccount: payment.payerAccountNumber,
          destinationBankCode: bankCode,
          narration: 'EduPay fee overpayment refund',
          reference,
        });
      }
      return success(res, { transfer }, 'Refund sent');
    } catch (err) {
      await FeeAssignment.findByIdAndUpdate(assignment._id, { $set: { overpaymentResolution: 'refund_requested' } });
      throw err;
    }
  } catch (err) { return error(res, err.message); }
};

// GET /api/payments/overpayments: awaiting a parent decision or a refund approval (staff)
const listOverpayments = async (req, res) => {
  try {
    if (req.user.role === 'parent') return forbidden(res, 'Access denied');
    const items = await FeeAssignment.find({
      schoolId: req.user.schoolId,
      status: 'overpaid',
      overpayment: { $gt: 0 },
      overpaymentResolution: { $in: ['pending', 'refund_requested'] },
    })
      .populate('studentId', 'fullName studentId class')
      .populate('feeStructureId', 'name term')
      .sort({ updatedAt: -1 })
      .lean();

    return success(res, {
      overpayments: items.map((a) => ({
        assignmentId: a._id,
        student:      a.studentId,
        fee:          a.feeStructureId?.name,
        term:         a.feeStructureId?.term,
        amount:       a.overpayment,
        resolution:   a.overpaymentResolution,
      })),
    });
  } catch (err) { return error(res); }
};

module.exports = { createManualPayment, getStudentPayments, getAssignmentSummary, triggerStudentSync, approveRefund, resolveOverpayment, listOverpayments };