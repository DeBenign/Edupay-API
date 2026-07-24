// src/routes/revenue.routes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { requirePlatformAdmin, tagPlatformAdmin } = require('../middleware/platformAdmin.middleware');
const { platformRevenue, allSchoolsRevenue, oneSchoolRevenue } = require('../controllers/revenue.controller');

router.use(protect);

router.get('/platform', requirePlatformAdmin, platformRevenue);
router.get('/schools',  requirePlatformAdmin, allSchoolsRevenue);
router.get('/schools/:schoolId', authorize('admin', 'bursar'), tagPlatformAdmin, oneSchoolRevenue);

module.exports = router;