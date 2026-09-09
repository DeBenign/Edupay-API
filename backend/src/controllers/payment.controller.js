// src/controllers/payment.controller.js
const Payment = require('../models/Payment');
const FeeAssignment = require('../models/FeeAssignment');
const paystackService = require('../services/paystack.service');
const nombaService = require('../services/nomba.service');
const { processManualPayment, getReconciliationSummary } = require('../services/reconciliation.service');
const { syncStudentTransactions } = require('../services/transaction.service');
const { success, created, badRequest, notFound, error } = require('../utils/apiResponse');
const { paginate } = require('../utils/paginate');

// POST /api/payments/manual — bursar records a cash/cheque payment
const createManualPayment = async (req, res) => {
  try {
    const { studentId, amountPaid, reference, narration, gateway } = req.body;
    if (!studentId || !amountPaid || !reference) {
      return badRequest(res, 'studentId, amountPaid, and reference are required');
    }
    if (amountPaid <= 0) return badRequest(res, 'amountPaid must be greater than 0');
    if (gateway && !['nomba', 'paystack'].includes(gateway)) {
      return badRequest(res, "gateway must be 'nomba' or 'paystack' if provided");
    }

    const io = req.app.locals.io || null;
    const result = await processManualPayment({ studentId, amountPaid, reference, narration, gateway, io });

    if (result.skipped) {
      return badRequest(res, `Payment skipped: ${result.reason}`);
    }

    return created(res, { result }, 'Manual payment recorded successfully');
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/payments/student/:studentId — full payment history
const getStudentPayments = async (req, res) => {
  try {
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
    const summary = await getReconciliationSummary(req.params.id);
    return success(res, summary);
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/payments/sync/:studentId — trigger a manual sync for one student
const triggerStudentSync = async (req, res) => {
  try {
    const io     = req.app.locals.io || null;
    const result = await syncStudentTransactions(req.params.studentId, io);
    return success(res, result, `Sync complete. Processed: ${result.processed}, Skipped: ${result.skipped}`);
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/payments/overpayments/:feeAssignmentId/resolve — parent chooses
const resolveOverpayment = async (req, res) => {
  try {
    const assignment = await FeeAssignment.findById(req.params.feeAssignmentId);
    if (!assignment) return badRequest(res, 'Fee assignment not found');
    if (assignment.status !== 'overpaid') return badRequest(res, 'No overpayment on this assignment');
    if (assignment.overpaymentResolution !== 'pending') return badRequest(res, 'Overpayment already resolved');

    const { choice } = req.body; // 'refund' | 'credit_next_term'

    if (choice === 'credit_next_term') {
    
      const { getOrCreateNextTermAssignment } = require('../services/fee.service');
      const nextAssignment = await getOrCreateNextTermAssignment(assignment.studentId);
      nextAssignment.amountExpected -= assignment.overpayment;
      await nextAssignment.save();
      assignment.overpaymentResolution = 'credited_next_term';
      await assignment.save();
      return success(res, { assignment }, 'Credited to next term');
    }

    if (choice === 'refund') {
      assignment.overpaymentResolution = 'refund_requested';
      await assignment.save();
      return success(res, { assignment }, 'Refund requested — awaiting bursar approval');
    }

    return badRequest(res, "choice must be 'refund' or 'credit_next_term'");
  } catch (err) { return error(res, err.message); }
};

// POST /api/payments/overpayments/:feeAssignmentId/approve-refund — bursar/admin only
const approveRefund = async (req, res) => {
  try {
    const assignment = await FeeAssignment.findById(req.params.feeAssignmentId);
    if (!assignment || assignment.overpaymentResolution !== 'refund_requested') {
      return badRequest(res, 'No pending refund for this assignment');
    }

    const payment = await Payment.findOne({
      feeAssignmentId: assignment._id,
      reconciliationStatus: 'overpayment',
    }).sort({ processedAt: -1 });

    if (!payment?.payerAccountNumber || !payment?.payerBankCode) {
      return badRequest(res, 'No payer account details on file for this payment — cannot refund');
    }

        // in approveRefund, before building `recipient`
    let bankCode = payment.payerBankCode;
    if (!bankCode && payment.payerBankName) {
      const banks = payment.gateway === 'paystack'
        ? await paystackService.listBanks()
        : await nombaService.getBankList();
      const match = banks.find(b =>
        b.name.toLowerCase().trim() === payment.payerBankName.toLowerCase().trim()
      );
      bankCode = match?.code || match?.bankCode || null;
    }
    if (!bankCode) {
      return badRequest(res, 'Could not resolve payer bank code — refund requires manual bank details entry');
    }


    let transfer;
    if (payment.gateway === 'paystack') {
      const recipient = await paystackService.createTransferRecipient({
        accountNumber: payment.payerAccountNumber,
        bankCode: payment.payerBankCode,
        accountName: payment.payerAccountName || 'EduPay Refund',
      });
      transfer = await paystackService.initiateTransfer({
        recipientCode: recipient.recipient_code,
        amount: assignment.overpayment,
        reason: 'EduPay fee overpayment refund',
        reference: `REFUND-${assignment._id}-${Date.now()}`,
      });
    } else {
      transfer = await nombaService.initiateTransfer({
        amount: assignment.overpayment,
        destinationAccount: payment.payerAccountNumber,
        destinationBankCode: payment.payerBankCode,
        narration: 'EduPay fee overpayment refund',
        reference: `REFUND-${assignment._id}-${Date.now()}`,
      });
    }

    assignment.overpaymentResolution = 'refunded';
    await assignment.save();
    return success(res, { transfer }, 'Refund sent');
  } catch (err) { return error(res, err.message); }
};

module.exports = { createManualPayment, getStudentPayments, getAssignmentSummary, triggerStudentSync, approveRefund, resolveOverpayment };
