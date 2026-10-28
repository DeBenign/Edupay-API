// src/routes/revenue.routes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { requirePlatformAdmin } = require('../middleware/platformAdmin.middleware');
const { platformRevenue, oneSchoolRevenue } = require('../controllers/revenue.controller');

router.use(protect);

router.get('/platform', requirePlatformAdmin, platformRevenue);
// A school's revenue is visible only to that school's own admin/bursar. Not to EduPay.
router.get('/schools/:schoolId', authorize('admin', 'bursar'), oneSchoolRevenue);

module.exports = router;