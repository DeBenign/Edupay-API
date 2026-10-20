const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { requirePlatformAdmin } = require('../middleware/platformAdmin.middleware');
const { mySubscription, listSubscriptions, recordPayment, setDeclaredStudents } = require('../controllers/subscription.controller');

router.get('/mine', protect, authorize('admin', 'bursar'), mySubscription);
router.get('/schools', protect, requirePlatformAdmin, listSubscriptions);
router.post('/schools/:schoolId/payments', protect, requirePlatformAdmin, recordPayment);
router.patch('/declared-students', protect, authorize('admin'), setDeclaredStudents);

module.exports = router;