// src/routes/withdrawal.routes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { requirePlatformAdmin, tagPlatformAdmin } = require('../middleware/platformAdmin.middleware');
const {
  withdrawPlatformRevenue,
  withdrawSchoolRevenue,
  schoolWithdrawalHistory,
} = require('../controllers/withdrawal.controller');

router.use(protect);

router.post('/platform', requirePlatformAdmin, withdrawPlatformRevenue);
router.post('/schools/:schoolId', authorize('admin', 'bursar'), withdrawSchoolRevenue);
router.get('/schools/:schoolId',  authorize('admin', 'bursar'), tagPlatformAdmin, schoolWithdrawalHistory);

module.exports = router;