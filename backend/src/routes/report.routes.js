// src/routes/report.routes.js
const express = require('express');
const router  = express.Router();
const {
  schoolSummary, classBreakdown, overpayments, studentStatement, recentPayments
} = require('../controllers/report.controller');
const { protect }    = require('../middleware/auth.middleware');
const { authorize }  = require('../middleware/role.middleware');

router.use(protect);

// Admin + bursar
router.get('/summary',                      authorize('admin','bursar'), schoolSummary);
router.get('/class',                        authorize('admin','bursar'), classBreakdown);
router.get('/overpayments',                 authorize('admin','bursar'), overpayments);
router.get('/recent',                       authorize('admin','bursar'), recentPayments);

// Admin, bursar, AND parent (parent guarded inside controller)
router.get('/student/:studentId/statement', authorize('admin','bursar','parent'), studentStatement);

module.exports = router;
