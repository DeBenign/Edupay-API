// src/controllers/webhook.controller.js
// ─────────────────────────────────────────────────────────────────────────────
// Entry point for all Nomba webhook events.
// Every inbound payment hits this endpoint first.
//
// Flow:
//   Nomba fires event
//     → middleware verifies HMAC signature
//     → controller logs the raw event
//     → extracts payment fields
//     → calls reconciliation engine
//     → responds 200 immediately (Nomba needs a fast ACK)
// ─────────────────────────────────────────────────────────────────────────────

const { WebhookLog } = require('../models/WebhookLog');
const { processPayment } = require('../services/reconciliation.service');
const { success, error } = require('../utils/apiResponse');

// ─── Known Nomba event types we care about ────────────────────────────────────
const CREDIT_EVENTS = new Set([
  'virtualaccount.credit',   // confirmed inbound transfer to a virtual account
  'transfer.credit',         // alternative event name used in some Nomba versions
  'transaction.successful',  // generic successful transaction
]);

// ─── POST /api/webhooks/nomba ─────────────────────────────────────────────────
const handleNombaWebhook = async (req, res) => {
  // ── ACK immediately — Nomba retries if we take too long ──────────────────
  // We respond 200 before processing so Nomba never marks our endpoint as down.
  res.status(200).json({ received: true });

  // ── Everything after this is async (fire-and-forget from Nomba's view) ───
  const payload   = req.body;
  const signature = req.headers['x-nomba-signature'] || null;
  const eventType = payload?.event || payload?.type || 'unknown';

  // 1. Log the raw webhook (for audit + replay)
  let webhookLog;
  try {
    webhookLog = await WebhookLog.create({
      event:     eventType,
      payload,
      signature,
      verified:  true, // middleware already verified before we got here
      processed: false,
    });
  } catch (logErr) {
    console.error('❌ Failed to log webhook:', logErr.message);
    // Continue processing even if logging fails
  }

  // 2. Only process credit events
  if (!CREDIT_EVENTS.has(eventType)) {
    console.log(`ℹ️  Webhook event "${eventType}" — not a credit event. Ignoring.`);
    if (webhookLog) {
      webhookLog.processed  = true;
      webhookLog.processingError = `Non-credit event: ${eventType}`;
      await webhookLog.save().catch(() => {});
    }
    return;
  }

  // 3. Extract payment fields from Nomba payload
  //    Nomba's payload structure (adjust field names if their schema differs):
  const data          = payload?.data || payload;
  const accountNumber = data?.destinationAccountNumber ||
                        data?.accountNumber            ||
                        data?.virtualAccountNumber;
  const amountPaid    = parseFloat(data?.amount || data?.transactionAmount || 0);
  const reference     = data?.reference         ||
                        data?.transactionReference ||
                        data?.id;
  const narration     = data?.narration         || data?.description || null;
  const payerName     = data?.sourceAccountName || data?.senderName  || null;
  const payerAccount  = data?.sourceAccountNumber || null;
  const payerBank     = data?.sourceBankName    || data?.senderBank  || null;

  // 4. Validate required fields
  if (!accountNumber || !amountPaid || !reference) {
    console.error('❌ Webhook missing required fields:', { accountNumber, amountPaid, reference });
    if (webhookLog) {
      webhookLog.processingError = 'Missing required fields: accountNumber, amountPaid, or reference';
      await webhookLog.save().catch(() => {});
    }
    return;
  }

  // 5. Get the Socket.io instance (attached in server.js)
  const io = req.app.locals.io || null;

  // 6. Run reconciliation
  try {
    const result = await processPayment({
      accountNumber,
      amountPaid,
      reference,
      narration,
      payerName,
      payerAccount,
      payerBank,
      source: 'webhook',
      io,
    });

    // 7. Mark webhook as processed
    if (webhookLog) {
      webhookLog.processed = true;
      await webhookLog.save().catch(() => {});
    }

    if (result.skipped) {
      console.log(`ℹ️  Webhook ${reference} skipped: ${result.reason}`);
    }

  } catch (err) {
    console.error(`❌ Webhook processing failed [${reference}]:`, err.message);

    if (webhookLog) {
      webhookLog.processingError = err.message;
      await webhookLog.save().catch(() => {});
    }
  }
};

// ─── GET /api/webhooks/logs ───────────────────────────────────────────────────
// Bursar/Admin can review webhook history for debugging
const getWebhookLogs = async (req, res) => {
  try {
    const page  = parseInt(req.query.page,  10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.processed !== undefined) filter.processed = req.query.processed === 'true';
    if (req.query.event)                   filter.event     = req.query.event;
    if (req.query.hasError === 'true')     filter.processingError = { $ne: null };

    const [logs, totalCount] = await Promise.all([
      WebhookLog.find(filter).sort({ receivedAt: -1 }).skip(skip).limit(limit),
      WebhookLog.countDocuments(filter),
    ]);

    return success(res, {
      logs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    console.error('❌ getWebhookLogs error:', err.message);
    return error(res);
  }
};

// ─── POST /api/webhooks/replay/:id ───────────────────────────────────────────
// Admin can replay a failed webhook — useful for debugging + recovery
const replayWebhook = async (req, res) => {
  try {
    const webhookLog = await WebhookLog.findById(req.params.id);
    if (!webhookLog) return error(res, 'Webhook log not found', 404);

    const payload       = webhookLog.payload;
    const data          = payload?.data || payload;
    const accountNumber = data?.destinationAccountNumber || data?.accountNumber;
    const amountPaid    = parseFloat(data?.amount || 0);
    const reference     = data?.reference || data?.transactionReference;

    if (!accountNumber || !amountPaid || !reference) {
      return error(res, 'Cannot replay — missing required fields in stored payload', 400);
    }

    const io     = req.app.locals.io || null;
    const result = await processPayment({
      accountNumber,
      amountPaid,
      reference: `${reference}_replay_${Date.now()}`, // new ref to bypass idempotency
      narration: 'Manually replayed webhook',
      source:    'manual',
      io,
    });

    return success(res, { result }, 'Webhook replayed successfully');
  } catch (err) {
    console.error('❌ replayWebhook error:', err.message);
    return error(res, err.message);
  }
};

// ─── POST /api/webhooks/paystack ───────────────────────────────────────────────
// Mirrors handleNombaWebhook exactly — same ACK-first pattern, same
// reconciliation engine, same WebhookLog audit trail. Only the field
// extraction differs because Paystack's payload shape is different.
const PAYSTACK_CREDIT_EVENTS = new Set([
  'charge.success',           // dedicated virtual account credit
  'dedicatedaccount.assign.success',
]);

const handlePaystackWebhook = async (req, res) => {
  res.status(200).json({ received: true });

  const payload   = req.body;
  const eventType = payload?.event || 'unknown';

  let webhookLog;
  try {
    webhookLog = await WebhookLog.create({
      event:     eventType,
      payload,
      signature: req.headers['x-paystack-signature'] || null,
      verified:  true, // middleware already verified before we got here
      processed: false,
    });
  } catch (logErr) {
    console.error('❌ Failed to log Paystack webhook:', logErr.message);
  }

  if (!PAYSTACK_CREDIT_EVENTS.has(eventType)) {
    console.log(`ℹ️  Paystack webhook event "${eventType}" — not a credit event. Ignoring.`);
    if (webhookLog) {
      webhookLog.processed = true;
      webhookLog.processingError = `Non-credit event: ${eventType}`;
      await webhookLog.save().catch(() => {});
    }
    return;
  }

  // Paystack's charge.success payload for a DVA credit nests the receiving
  // account under data.authorization / data.metadata depending on channel —
  // dedicated_account is the field to trust for transfer-in charges.
  const data          = payload?.data || {};
  const accountNumber = data?.authorization?.receiver_bank_account_number
                        || data?.dedicated_account?.account_number
                        || null;
  const amountPaid    = data?.amount ? data.amount / 100 : 0; // Paystack sends kobo
  const reference     = data?.reference || null;
  const narration     = data?.narration || null;
  const payerName     = data?.customer?.first_name
                        ? `${data.customer.first_name} ${data.customer.last_name || ''}`.trim()
                        : null;
  const payerAccount  = data?.authorization?.sender_bank_account_number || null;
  const payerBank     = data?.authorization?.sender_bank || null;

  if (!accountNumber || !amountPaid || !reference) {
    console.error('❌ Paystack webhook missing required fields:', { accountNumber, amountPaid, reference });
    if (webhookLog) {
      webhookLog.processingError = 'Missing required fields: accountNumber, amountPaid, or reference';
      await webhookLog.save().catch(() => {});
    }
    return;
  }

  const io = req.app.locals.io || null;

  try {
    const result = await processPayment({
      accountNumber,
      amountPaid,
      reference,
      narration,
      payerName,
      payerAccount,
      payerBank,
      source: 'webhook',
      io,
    });

    if (webhookLog) {
      webhookLog.processed = true;
      await webhookLog.save().catch(() => {});
    }

    if (result.skipped) {
      console.log(`ℹ️  Paystack webhook ${reference} skipped: ${result.reason}`);
    }
  } catch (err) {
    console.error(`❌ Paystack webhook processing failed [${reference}]:`, err.message);
    if (webhookLog) {
      webhookLog.processingError = err.message;
      await webhookLog.save().catch(() => {});
    }
  }
};

module.exports = { handleNombaWebhook, handlePaystackWebhook, getWebhookLogs, replayWebhook };