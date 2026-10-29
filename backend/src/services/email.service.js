// src/services/email.service.js
// Sends email over SMTP (Brevo, Zoho, Resend SMTP, SendGrid, Gmail app password: anything with SMTP).
// sendEmail NEVER throws: a mail problem must not break a sign-up, a decision or a payment.
// It returns { sent, reason?, detail? } so callers can tell the user when it matters (e.g. resend verification).
const nodemailer = require('nodemailer');

const configured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;
const getTransport = () => {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,            // 465 = implicit TLS; 587 / 2525 upgrade with STARTTLS automatically
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000, // fail fast on serverless
  });
  return transporter;
};

const fromAddress = () => process.env.EMAIL_FROM || `EduPay <${process.env.SMTP_USER}>`;

// Short, safe description of why SMTP failed (never includes the password)
const describe = (err) => {
  if (err.code === 'EAUTH' || err.responseCode === 535) return 'login rejected: check SMTP_USER and SMTP_PASS';
  if (err.code === 'ESOCKET' || err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT') return `cannot reach ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}: check SMTP_HOST and SMTP_PORT`;
  if (err.responseCode === 550 || err.responseCode === 553) return 'sender or recipient refused: EMAIL_FROM must be a sender your provider has verified';
  return err.message;
};

// Used by scripts/testEmail.js: proves host, port and login work without sending anything
const verifyConnection = async () => {
  if (!configured()) return { ok: false, reason: 'not_configured' };
  try { await getTransport().verify(); return { ok: true }; }
  catch (err) { return { ok: false, reason: 'error', detail: describe(err) }; }
};

const sendEmail = async ({ to, subject, html, text }) => {
  const recipients = [].concat(to || []).map((e) => String(e || '').trim()).filter(Boolean);
  if (!recipients.length) return { sent: false, reason: 'no_recipient' };
  if (!configured()) {
    console.log(`📧 [email not configured] "${subject}" -> ${recipients.join(', ')}`);
    // Development convenience: show the message (with its links) in the terminal. Never in production.
    if (process.env.NODE_ENV !== 'production') console.log(text);
    return { sent: false, reason: 'not_configured' };
  }
  try {
    await getTransport().sendMail({ from: fromAddress(), to: recipients.join(', '), subject, html, text });
    return { sent: true };
  } catch (err) {
    const detail = describe(err);
    console.error(`❌ Email failed ("${subject}"): ${detail}`);
    return { sent: false, reason: 'error', detail };
  }
};

if (process.env.NODE_ENV === 'production' && !configured()) {
  console.warn('⚠️  SMTP is not configured: verification and notification emails will NOT be sent. Set SMTP_HOST, SMTP_USER, SMTP_PASS and EMAIL_FROM.');
}

module.exports = { sendEmail, configured, verifyConnection, fromAddress };
