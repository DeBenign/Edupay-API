const express = require('express');
const router  = express.Router();
const { register, login, getMe, changePassword, createStaff, verifyEmail, resendVerification, forgotPassword, resetPassword } = require('../controllers/auth.controller');
const rateLimit     = require('express-rate-limit');
const { protect }   = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { requireActiveSubscription } = require('../middleware/subscription.middleware');

router.post('/register',         register);
router.post('/login',            login);
// Public password-reset endpoints get a tighter limit than the rest of the API (per server instance)
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' } });
router.post('/forgot-password',  resetLimiter, forgotPassword);
router.post('/reset-password',   resetLimiter, resetPassword);
router.post('/verify-email',     verifyEmail);
router.post('/resend-verification', protect,                  resendVerification);
router.get('/me',                protect,                     getMe);
router.patch('/change-password', protect,                     changePassword);
router.post('/create-staff',     protect, authorize('admin'), requireActiveSubscription, createStaff);

module.exports = router;
