// src/routes/webhook.routes.js
const express = require('express');
const router = express.Router();
const { handleNombaWebhook, handlePaystackWebhook, getWebhookLogs, replayWebhook } = require('../controllers/webhook.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// Public: signatures are verified in app.js (webhook.middleware.js)
router.post('/nomba',    handleNombaWebhook);
router.post('/paystack', handlePaystackWebhook);

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