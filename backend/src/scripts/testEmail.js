// Proves your SMTP settings work, then sends one real test email.
// Usage:  node src/scripts/testEmail.js you@yourinbox.com
require('dotenv').config();
const email = require('../services/email.service');

(async () => {
  const to = process.argv[2];
  if (!to || !to.includes('@')) { console.error('Usage: node src/scripts/testEmail.js you@yourinbox.com'); process.exit(1); }

  const show = (k) => `${k}=${process.env[k] ? (k === 'SMTP_PASS' ? '(set)' : process.env[k]) : '(MISSING)'}`;
  console.log(['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'].map(show).join('\n'));

  console.log('\n1) Connecting and logging in to the SMTP server...');
  const link = await email.verifyConnection();
  if (!link.ok) { console.error(`❌ ${link.reason === 'not_configured' ? 'Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env first' : link.detail}`); process.exit(1); }
  console.log('✅ Connected and logged in');

  console.log(`\n2) Sending a test email to ${to} from ${email.fromAddress()} ...`);
  const r = await email.sendEmail({
    to, subject: 'EduPay email test',
    text: 'If you can read this, EduPay can send email. Check that it did not land in spam.',
    html: '<p>If you can read this, <b>EduPay can send email</b>. Check that it did not land in spam.</p>',
  });
  if (!r.sent) { console.error(`❌ Not sent: ${r.detail || r.reason}`); process.exit(1); }
  console.log('✅ Sent. Open the inbox (and the spam folder) to confirm.');
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
