// src/services/email.service.js
// Sends email over SMTP (Brevo, Zoho, Resend SMTP, SendGrid, Gmail app password: anything with SMTP).
// sendEmail NEVER throws: a mail problem must not break a sign-up, a decision or a payment.
// It returns { sent, reason? } so callers can tell the user when it matters (e.g. resend verification).
const nodemailer = require('nodemailer');

const configured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;
const getTransport = () => {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000, // fail fast on serverless
  });
  return transporter;
};

const fromAddress = () => process.env.EMAIL_FROM || `EduPay <${process.env.SMTP_USER}>`;

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
    console.error(`❌ Email failed ("${subject}"):`, err.message);
    return { sent: false, reason: 'error' };
  }
};

if (process.env.NODE_ENV === 'production' && !configured()) {
  console.warn('⚠️  SMTP is not configured: verification and notification emails will NOT be sent. Set SMTP_HOST, SMTP_USER, SMTP_PASS and EMAIL_FROM.');
}

module.exports = { sendEmail, configured };
