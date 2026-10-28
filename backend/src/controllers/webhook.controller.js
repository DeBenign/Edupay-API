// src/controllers/webhook.controller.js
const { WebhookLog } = require('../models/WebhookLog');
const { processPayment } = require('../services/reconciliation.service');
const { findStudentByAccountNumber } = require('../services/virtualAccount.service');
const { success, error } = require('../utils/apiResponse');

const NOMBA_CREDIT_EVENTS    = new Set(['payment_success']);
const PAYSTACK_CREDIT_EVENTS = new Set(['charge.success']);

// ─── Field extraction (shared by live handlers and replay) ───────────────────
const extractNombaPayment = (payload) => {
  const tx = payload?.data?.transaction || {};
  const customer = payload?.data?.customer || {};
  return {
    accountNumber: tx.aliasAccountNumber || null,
    amountPaid:    Number(tx.transactionAmount) || 0,
    reference:     tx.transactionId || null,
    narration:     tx.narration || null,
    payerName:     customer.senderName || null,
    payerAccount:  customer.accountNumber || null,
    payerBank:     customer.bankName || null,
    payerBankCode: customer.bankCode || null,
    gatewayFee:    Number(tx.fee) || 0,
  };
};

const extractPaystackPayment = (payload) => {
  const data = payload?.data || {};
  const auth = data.authorization || {};
  const customerName = data.customer?.first_name
    ? `${data.customer.first_name} ${data.customer.last_name || ''}`.trim()
    : null;
  return {
    accountNumber: auth.receiver_bank_account_number || data.dedicated_account?.account_number || null,
    amountPaid:    data.amount ? data.amount / 100 : 0, // Paystack sends kobo
    reference:     data.reference || null,
    narration:     auth.narration || data.narration || null,
    payerName:     auth.sender_name || customerName,
    payerAccount:  auth.sender_bank_account_number || null,
    payerBank:     auth.sender_bank || null,
    payerBankCode: auth.sender_bank_code || null,
    gatewayFee:    data.fees ? data.fees / 100 : 0, // unverified field name
  };
};

// ─── Shared: validate → tag school → reconcile → update the audit log ────────
const runReconciliation = async ({ fields, webhookLog, io }) => {
  const { accountNumber, amountPaid, reference } = fields;

  if (!accountNumber || !amountPaid || !reference) {
    const msg = 'Missing required fields: accountNumber, amountPaid, or reference';
    console.error('❌ Webhook:', msg, { accountNumber, amountPaid, reference });
    if (webhookLog) {
      webhookLog.processingError = msg;
      await webhookLog.save().catch(() => {});
    }
    return { skipped: true, reason: 'missing_fields' };
  }

  // Tag the log with the owning school so logs and replays can be scoped per school
  const owner = await findStudentByAccountNumber(accountNumber).catch(() => null);
  if (webhookLog && owner) webhookLog.schoolId = owner.schoolId;

  try {
    const result = await processPayment({ ...fields, source: 'webhook', io });

    if (webhookLog) {
      // Leave failed/skipped events unprocessed so they stay replayable
      webhookLog.processed = !result.skipped || result.reason === 'duplicate_reference';
      webhookLog.processingError = result.skipped ? `Skipped: ${result.reason}` : null;
      await webhookLog.save().catch(() => {});
    }
    if (result.skipped) console.log(`ℹ️  Webhook ${reference} skipped: ${result.reason}`);
    return result;
  } catch (err) {
    console.error(`❌ Webhook processing failed [${reference}]:`, err.message);
    if (webhookLog) {
      webhookLog.processingError = err.message;
      await webhookLog.save().catch(() => {});
    }
    return { skipped: true, reason: 'processing_error', error: err.message };
  }
};

// ─── Live handler factory (ACK first, then process) ──────────────────────────
const makeEventProcessor = ({ creditEvents, extract, signatureHeader, label, isRelevant }) => async (req) => {
  const payload   = req.body;
  const eventType = payload?.event_type || payload?.event || 'unknown'; // Nomba: event_type, Paystack: event

  let webhookLog;
  try {
    webhookLog = await WebhookLog.create({
      event:     eventType,
      payload,
      signature: req.headers[signatureHeader] || null,
      verified:  true, // verified by middleware before we got here
      processed: false,
    });
  } catch (logErr) {
    console.error(`❌ Failed to log ${label} webhook:`, logErr.message);
  }

  if (!creditEvents.has(eventType)) {
    console.log(`ℹ️  ${label} webhook event "${eventType}" is not a credit event. Ignoring.`);
    if (webhookLog) {
      webhookLog.processed = true;
      webhookLog.processingError = `Non-credit event: ${eventType}`;
      await webhookLog.save().catch(() => {});
    }
    return;
  }

  if (isRelevant && !isRelevant(payload)) {
    console.log(`ℹ️  ${label} webhook "${eventType}" is not a virtual-account transfer. Ignoring.`);
    if (webhookLog) {
      webhookLog.processed = true;
      webhookLog.processingError = 'Not a virtual-account transfer';
      await webhookLog.save().catch(() => {});
    }
    return;
  }

  await runReconciliation({
    fields: extract(payload),
    webhookLog,
    io: req.app.locals.io || null,
  });
};

// Long-running host: acknowledge first, then process (gateways get a fast reply).
// Serverless (Vercel): the function can be frozen the moment the response is sent, which would lose the
// payment, so process first and acknowledge after. Duplicates are safe: processing is idempotent by reference.
const makeWebhookHandler = (config) => {
  const processEvent = makeEventProcessor(config);
  return async (req, res) => {
    const ack = () => { if (!res.headersSent) res.status(200).json({ received: true }); };
    if (!process.env.VERCEL) ack();
    try { await processEvent(req); }
    catch (err) { console.error(`❌ ${config.label} webhook handler failed:`, err.message); }
    finally { ack(); }
  };
};

const handleNombaWebhook = makeWebhookHandler({
  creditEvents:    NOMBA_CREDIT_EVENTS,
  extract:         extractNombaPayment,
  signatureHeader: 'nomba-signature',
  label:           'Nomba',
  isRelevant:      (p) => p?.data?.transaction?.type === 'vact_transfer',
});

const handlePaystackWebhook = makeWebhookHandler({
  creditEvents:    PAYSTACK_CREDIT_EVENTS,
  extract:         extractPaystackPayment,
  signatureHeader: 'x-paystack-signature',
  label:           'Paystack',
});

// ─── GET /api/webhooks/logs (scoped to the admin's school) ───────────────────
const getWebhookLogs = async (req, res) => {
  try {
    const page  = parseInt(req.query.page,  10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip  = (page - 1) * limit;

    const filter = { schoolId: req.user.schoolId };
    if (req.query.processed !== undefined) filter.processed = req.query.processed === 'true';
    if (req.query.event)                   filter.event     = req.query.event;
    if (req.query.hasError === 'true')     filter.processingError = { $ne: null };

    const [logs, totalCount] = await Promise.all([
      WebhookLog.find(filter).sort({ receivedAt: -1 }).skip(skip).limit(limit),
      WebhookLog.countDocuments(filter),
    ]);

    return success(res, {
      logs,
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (err) {
    console.error('❌ getWebhookLogs error:', err.message);
    return error(res);
  }
};

// ─── POST /api/webhooks/replay/:id ───────────────────────────────────────────
// The original reference is reused on purpose: the duplicate check in
// processPayment makes replaying an already-credited payment a safe no-op.
const replayWebhook = async (req, res) => {
  try {
    const webhookLog = await WebhookLog.findById(req.params.id);
    if (!webhookLog) return error(res, 'Webhook log not found', 404);
    if (webhookLog.schoolId?.toString() !== req.user.schoolId?.toString()) return error(res, 'Access denied', 403);

    const extract = PAYSTACK_CREDIT_EVENTS.has(webhookLog.event) ? extractPaystackPayment : extractNombaPayment;
    const result = await runReconciliation({
      fields: extract(webhookLog.payload),
      webhookLog,
      io: req.app.locals.io || null,
    });

    if (result.reason === 'duplicate_reference') return error(res, 'Already processed, nothing to replay', 400);
    if (result.reason === 'missing_fields')      return error(res, 'Cannot replay: missing required fields in stored payload', 400);
    if (result.skipped)                          return error(res, `Replay skipped: ${result.reason}`, 400);

    return success(res, { result }, 'Webhook replayed successfully');
  } catch (err) {
    console.error('❌ replayWebhook error:', err.message);
    return error(res, err.message);
  }
};

module.exports = { handleNombaWebhook, handlePaystackWebhook, getWebhookLogs, replayWebhook };