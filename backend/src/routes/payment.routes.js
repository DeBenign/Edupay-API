// src/routes/payment.routes.js
const express = require('express');
const router = express.Router();
const { createManualPayment, getStudentPayments, getAssignmentSummary, triggerStudentSync, approveRefund, resolveOverpayment, listOverpayments } = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { requireActiveSubscription } = require('../middleware/subscription.middleware');

router.use(protect);
router.post('/manual', authorize('admin', 'bursar'), requireActiveSubscription, createManualPayment);
router.get('/student/:studentId', authorize('admin', 'bursar', 'parent'), getStudentPayments);
router.get('/assignment/:id', authorize('admin', 'bursar'), getAssignmentSummary);
router.post('/sync/:studentId',    authorize('admin', 'bursar'), triggerStudentSync);
router.post('/overpayments/:feeAssignmentId/resolve', protect, authorize('parent', 'admin', 'bursar'), resolveOverpayment);
router.post('/overpayments/:feeAssignmentId/approve-refund', protect, authorize('admin', 'bursar'), approveRefund);
router.get('/overpayments', protect, authorize('admin', 'bursar'), listOverpayments);

module.exports = router;
