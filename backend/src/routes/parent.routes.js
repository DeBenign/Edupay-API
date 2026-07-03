// src/routes/parent.routes.js
const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getChildren,
  getChildAccount,
  getChildBalance,
  getChildPaymentHistory,
  linkChild,
  unlinkChild,
  getNotifications,
} = require('../controllers/parent.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// All parent routes require auth and parent role
router.use(protect, authorize('parent'));

// ─── Dashboard ────────────────────────────────────────────────────────────────
// All children + payment statuses in one call
router.get('/dashboard', getDashboard);

// ─── Children ─────────────────────────────────────────────────────────────────
router.get('/children',                              getChildren);
router.post('/link-child',                           linkChild);
router.delete('/children/:studentId/unlink',         unlinkChild);

// ─── Per-child detail routes ──────────────────────────────────────────────────
router.get('/children/:studentId/account',           getChildAccount);
router.get('/children/:studentId/balance',           getChildBalance);
router.get('/children/:studentId/payments',          getChildPaymentHistory);

// ─── Notifications ────────────────────────────────────────────────────────────
router.get('/notifications',                         getNotifications);

module.exports = router;
