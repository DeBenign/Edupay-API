// src/routes/webhook.routes.js
const express = require('express');
const router = express.Router();
const { handleNombaWebhook, getWebhookLogs, replayWebhook } = require('../controllers/webhook.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// Public — Nomba calls this (signature already verified by middleware in app.js)
router.post('/nomba', handleNombaWebhook);

// Protected — admin/bursar only
router.get('/logs',        protect, authorize('admin', 'bursar'), getWebhookLogs);
router.post('/replay/:id', protect, authorize('admin'),           replayWebhook);
router.post('/debug/sync-now', protect, authorize('admin'), async (req, res) => {
  const { syncTransactions } = require('../services/transaction.service');
  const result = await syncTransactions(null);
  res.json(result);
});
module.exports = router;
