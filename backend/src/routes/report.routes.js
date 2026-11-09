// src/routes/report.routes.js
const express = require('express');
const router  = express.Router();
const {
  schoolSummary, classBreakdown, feesPaid, overpayments, studentStatement, recentPayments, schoolRevenue, platformRevenue
} = require('../controllers/report.controller');
const { requirePlatformAdmin } = require('../middleware/platformAdmin.middleware');


const { protect }    = require('../middleware/auth.middleware');
const { authorize }  = require('../middleware/role.middleware');

router.use(protect);

// Admin + bursar
router.get('/summary',                      authorize('admin','bursar'), schoolSummary);
router.get('/class',                        authorize('admin','bursar'), classBreakdown);
router.get('/fees-paid',                    authorize('admin','bursar'), feesPaid);
router.get('/overpayments',                 authorize('admin','bursar'), overpayments);
router.get('/recent',                       authorize('admin','bursar'), recentPayments);

// Admin, bursar, AND parent (parent guarded inside controller)
router.get('/student/:studentId/statement', authorize('admin','bursar','parent'), studentStatement);

router.get('/school-revenue/:schoolId', authorize('admin', 'bursar'), schoolRevenue);
router.get('/platform-revenue', requirePlatformAdmin, platformRevenue);
module.exports = router;
