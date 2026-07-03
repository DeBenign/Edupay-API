// src/controllers/payment.controller.js
const Payment = require('../models/Payment');
const FeeAssignment = require('../models/FeeAssignment');
const { processManualPayment, getReconciliationSummary } = require('../services/reconciliation.service');
const { syncStudentTransactions } = require('../services/transaction.service');
const { success, created, badRequest, notFound, error } = require('../utils/apiResponse');
const { paginate } = require('../utils/paginate');

// POST /api/payments/manual — bursar records a cash/cheque payment
const createManualPayment = async (req, res) => {
  try {
    const { studentId, amountPaid, reference, narration } = req.body;
    if (!studentId || !amountPaid || !reference) {
      return badRequest(res, 'studentId, amountPaid, and reference are required');
    }
    if (amountPaid <= 0) return badRequest(res, 'amountPaid must be greater than 0');

    const io     = req.app.locals.io || null;
    const result = await processManualPayment({ studentId, amountPaid, reference, narration, io });

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

module.exports = { createManualPayment, getStudentPayments, getAssignmentSummary, triggerStudentSync };
