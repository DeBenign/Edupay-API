// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const {
  register, login, getMe, changePassword, createStaff,
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// Public
router.post('/register', register);
router.post('/login', login);

// Protected
router.get('/me', protect, getMe);
router.patch('/change-password', protect, changePassword);
router.post('/create-staff',     protect, authorize('admin'), createStaff);

module.exports = router;
