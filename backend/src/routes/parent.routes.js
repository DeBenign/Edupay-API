const express = require('express');
const router  = express.Router();
const {
  getDashboard, getChildren, getChildAccount, getChildBalance,
  getChildPaymentHistory, linkChild, unlinkChild, getNotifications,
} = require('../controllers/parent.controller');
const { protect }   = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(protect, authorize('parent'));
router.get('/dashboard',                       getDashboard);
router.get('/children',                        getChildren);
router.post('/link-child',                     linkChild);
router.delete('/children/:studentId/unlink',   unlinkChild);
router.get('/children/:studentId/account',     getChildAccount);
router.get('/children/:studentId/balance',     getChildBalance);
router.get('/children/:studentId/payments',    getChildPaymentHistory);
router.get('/notifications',                   getNotifications);

module.exports = router;
