// src/services/outbox.service.js
// Try to send now (with a short deadline); if the mail provider fails or is slow, keep the email and retry later.
// Used for emails that matter and are not time-critical (receipts, decisions). Verification and reset links are
// NOT queued: they expire, and the person can simply ask again.
const email = require('./email.service');
const EmailOutbox = require('../models/EmailOutbox');

const SEND_DEADLINE_MS = Number(process.env.EMAIL_SEND_DEADLINE_MS) || 4000; // never hold a request or webhook longer than this for an email
const MAX_ATTEMPTS     = 5;
const MIN = 60 * 1000;

const withDeadline = (promise, ms) => {
  let timer;
  const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve({ sent: false, reason: 'timeout' }), ms); });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
};
const attempt = async (message, ms) => {
  try { return await withDeadline(email.sendEmail(message), ms); }
  catch { return { sent: false, reason: 'error' }; }
};

const sendReliably = async (message, kind = 'general') => {
  const result = await attempt(message, SEND_DEADLINE_MS);
  if (result.sent || !['error', 'timeout'].includes(result.reason)) return result; // sent, or nothing to retry (not configured / no recipient)
  try {
    await EmailOutbox.create({
      to: [].concat(message.to), subject: message.subject, html: message.html, text: message.text,
      kind, attempts: 1, nextAttemptAt: new Date(Date.now() + 15 * MIN), lastError: result.reason,
    });
    return { ...result, queued: true };
  } catch (err) {
    console.error('❌ Could not queue email for retry:', err.message);
    return result;
  }
};

// Called by the daily job and by /api/cron/emails. Safe to run often and concurrently.
const flushOutbox = async (now = Date.now()) => {
  const due = await EmailOutbox.find({ status: 'pending', nextAttemptAt: { $lte: new Date(now) } }).sort({ nextAttemptAt: 1 }).limit(50);
  const out = { sent: 0, retrying: 0, failed: 0 };
  for (const m of due) {
    // Claim it: push the next attempt out so a concurrent run skips this one
    const claim = await EmailOutbox.updateOne({ _id: m._id, status: 'pending', nextAttemptAt: m.nextAttemptAt }, { $set: { nextAttemptAt: new Date(now + 30 * MIN) } });
    if (!claim.modifiedCount) continue;
    const result = await attempt({ to: m.to, subject: m.subject, html: m.html, text: m.text }, 8000);
    if (result.sent) {
      await EmailOutbox.updateOne({ _id: m._id }, { $set: { status: 'sent', sentAt: new Date() } });
      out.sent++;
    } else if (m.attempts + 1 >= MAX_ATTEMPTS) {
      await EmailOutbox.updateOne({ _id: m._id }, { $set: { status: 'failed', attempts: m.attempts + 1, lastError: result.reason || 'error' } });
      out.failed++;
    } else {
      await EmailOutbox.updateOne({ _id: m._id }, { $set: { attempts: m.attempts + 1, lastError: result.reason || 'error', nextAttemptAt: new Date(now + (m.attempts + 1) * 30 * MIN) } });
      out.retrying++;
    }
  }
  await EmailOutbox.updateMany({ status: 'pending', createdAt: { $lt: new Date(now - 3 * 24 * 60 * MIN) } }, { $set: { status: 'failed', lastError: 'expired' } });
  return out;
};

module.exports = { sendReliably, flushOutbox, MAX_ATTEMPTS };
