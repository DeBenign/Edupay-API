// src/services/sms.service.js
// SMS through Termii (Nigerian provider). Safe: it never throws and never logs the API key.
// WhatsApp is not wired in: proactive WhatsApp messages need Meta-approved templates. When that is ready,
// add a sender next to sendSms and list it in feeReminder.service.js.
const apiKey  = () => process.env.TERMII_API_KEY;
const sender  = () => process.env.TERMII_SENDER_ID;
// Fee reminders are transactional, so the DND route is the default (it also reaches numbers that block promotions).
const channel = () => (process.env.TERMII_CHANNEL === 'generic' ? 'generic' : 'dnd');
const baseUrl = () => (process.env.TERMII_BASE_URL || 'https://api.ng.termii.com').replace(/\/+$/, '');

const configured = () => Boolean(apiKey() && sender());

// 0803 123 4567, +234 803 123 4567, 2348031234567, 8031234567  ->  2348031234567.  Anything else -> null.
const toNigerianMsisdn = (raw) => {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (/^234[789]\d{9}$/.test(d)) return d;
  if (/^2340[789]\d{9}$/.test(d)) return '234' + d.slice(4);   // "+234 (0)803..."
  if (/^0[789]\d{9}$/.test(d)) return '234' + d.slice(1);
  if (/^[789]\d{9}$/.test(d)) return '234' + d;
  return null;
};

const sendSms = async (rawTo, text) => {
  if (!configured()) return { sent: false, reason: 'not_configured' };
  const to = toNigerianMsisdn(rawTo);
  if (!to) return { sent: false, reason: 'bad_number' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${baseUrl()}/api/sms/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ api_key: apiKey(), to, from: sender(), sms: String(text).slice(0, 600), type: 'plain', channel: channel() }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.message_id) return { sent: true, id: body.message_id };
    console.error('SMS not sent:', res.status, body.message || '');
    return { sent: false, reason: 'provider_error' };
  } catch (err) {
    console.error('SMS not sent:', err.name === 'AbortError' ? 'timeout' : err.message);
    return { sent: false, reason: 'error' };
  } finally { clearTimeout(timer); }
};

module.exports = { configured, toNigerianMsisdn, sendSms };
