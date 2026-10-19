const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { requirePlatformAdmin } = require('../middleware/platformAdmin.middleware');
const {
  listReferrals,
  rewardFeeWaiver,
  getMyRewards,
  claimReward, 
  getDataPlans
} = require('../controllers/referral.controller');

// Self-serve, own-reward-only — must stay OUTSIDE the requirePlatformAdmin gate
router.get('/rewards', protect, getMyRewards);
router.post('/rewards/:rewardId/claim', protect, claimReward);

// Platform-admin-only from here
router.use(protect, requirePlatformAdmin);
router.get('/', listReferrals);
router.post('/:id/reward/fee-waiver', rewardFeeWaiver);
router.get('/data-plans', protect, getDataPlans);

module.exports = router;