const express = require('express');
const router  = express.Router();
const {
  getDashboard, getChildren, getChildAccount, getChildBalance,
  getChildPaymentHistory, linkChild, unlinkChild, getNotifications,
} = require('../controllers/parent.controller');
const { protect }   = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const rateLimit = require('express-rate-limit');

// Limits code-guessing. Only failed attempts count, so linking several children is never blocked.
const linkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => String(req.user._id),   // safe now: protect has already set req.user
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
});

// Everything below requires a logged-in parent
router.use(protect, authorize('parent'));

router.get('/dashboard',                       getDashboard);
router.get('/children',                        getChildren);
router.post('/link-child',                     linkLimiter, linkChild);
router.delete('/children/:studentId/unlink',   unlinkChild);
router.get('/children/:studentId/account',     getChildAccount);
router.get('/children/:studentId/balance',     getChildBalance);
router.get('/children/:studentId/payments',    getChildPaymentHistory);
router.get('/notifications',                   getNotifications);

module.exports = router;