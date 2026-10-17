// src/routes/webhook.routes.js
const express = require('express');
const router = express.Router();
const { handleNombaWebhook, handlePaystackWebhook, getWebhookLogs, replayWebhook } = require('../controllers/webhook.controller');
const { verifyNombaSignature } = require('../middleware/nombaSignature.middleware');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// Public — signature verified by middleware in app.js
router.post('/nomba', verifyNombaSignature, handleNombaWebhook);
router.post('/paystack', handlePaystackWebhook);

// Protected
router.get('/logs',        protect, authorize('admin', 'bursar'), getWebhookLogs);
router.post('/replay/:id', protect, authorize('admin'),           replayWebhook);

// Dev-only: never exposed in production
if (process.env.NODE_ENV !== 'production') {
  router.post('/debug/sync-now', protect, authorize('admin'), async (req, res) => {
    try {
      const { syncTransactions } = require('../services/transaction.service');
      res.json(await syncTransactions(null));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
}

module.exports = router;