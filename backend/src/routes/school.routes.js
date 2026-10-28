const express = require('express');
const router  = express.Router();
const { createSchool, getMySchool, updateSchool } = require('../controllers/school.controller');
const { approveSchool, rejectSchool, requestInfo, suspendSchool, reinstateSchool, listApplications, resubmitApplication, listUnverifiedSignups, verifyEmailManually } = require('../controllers/approval.controller');
const { protect }   = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { requirePlatformAdmin } = require('../middleware/platformAdmin.middleware');

router.post('/',     protect, authorize('admin'), createSchool);
router.get('/me',    protect,                     getMySchool);

// Applicant: fix details, then resubmit after EduPay asked for more information
router.post('/my/resubmit', protect, authorize('admin'), resubmitApplication);

// EduPay owner: review queue and decisions (declared before '/:id')
router.get('/applications',      protect, requirePlatformAdmin, listApplications);
router.get('/signups/unverified', protect, requirePlatformAdmin, listUnverifiedSignups);
router.post('/signups/:userId/verify-email', protect, requirePlatformAdmin, verifyEmailManually);
router.post('/:id/approve',      protect, requirePlatformAdmin, approveSchool);
router.post('/:id/reject',       protect, requirePlatformAdmin, rejectSchool);
router.post('/:id/request-info', protect, requirePlatformAdmin, requestInfo);
router.post('/:id/suspend',      protect, requirePlatformAdmin, suspendSchool);
router.post('/:id/reinstate',    protect, requirePlatformAdmin, reinstateSchool);

router.patch('/:id', protect, authorize('admin'), updateSchool);

module.exports = router;
