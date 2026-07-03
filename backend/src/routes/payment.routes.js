// src/routes/payment.routes.js
const express = require('express');
const router = express.Router();
const { createManualPayment, getStudentPayments, getAssignmentSummary, triggerStudentSync } = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(protect);
router.post('/manual',                  authorize('admin', 'bursar'), createManualPayment);
router.get('/student/:studentId',       authorize('admin', 'bursar', 'parent'), getStudentPayments);
router.get('/assignment/:id',           authorize('admin', 'bursar'), getAssignmentSummary);
router.post('/sync/:studentId',         authorize('admin', 'bursar'), triggerStudentSync);

module.exports = router;
