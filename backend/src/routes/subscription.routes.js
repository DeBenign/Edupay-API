const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { requirePlatformAdmin } = require('../middleware/platformAdmin.middleware');
const { mySubscription, listSubscriptions, recordPayment, extendAccess } = require('../controllers/subscription.controller');
const { getPricing } = require('../controllers/pricing.controller');

// Public: live pricing numbers for the website (no login)
router.get('/pricing', getPricing);

router.get('/mine', protect, authorize('admin', 'bursar'), mySubscription);
router.get('/schools', protect, requirePlatformAdmin, listSubscriptions);
router.post('/schools/:schoolId/payments', protect, requirePlatformAdmin, recordPayment);
router.post('/schools/:schoolId/extend', protect, requirePlatformAdmin, extendAccess);

module.exports = router;
