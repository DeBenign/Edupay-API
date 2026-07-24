// src/routes/referral.routes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { requirePlatformAdmin } = require('../middleware/platformAdmin.middleware');
const { listReferrals, rewardFeeWaiver, rewardAirtime } = require('../controllers/referral.controller');

router.use(protect, requirePlatformAdmin);

router.get('/', listReferrals);
router.post('/:id/reward/fee-waiver', rewardFeeWaiver);
router.post('/:id/reward/airtime',    rewardAirtime);

module.exports = router;