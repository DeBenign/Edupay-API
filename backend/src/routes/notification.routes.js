// src/routes/notification.routes.js
const express = require('express');
const router = express.Router();
const { getNotifications, markAllRead, markOneRead } = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.get('/',                   getNotifications);
router.patch('/read-all',         markAllRead);
router.patch('/:id/read',         markOneRead);

module.exports = router;
