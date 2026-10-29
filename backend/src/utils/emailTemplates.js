// src/utils/emailTemplates.js
// Every dynamic value is HTML-escaped: school names and reasons are typed by users.
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Email clients cannot load SVG or localhost, so the logo is a hosted PNG and is skipped in local development
const LOGO_URL = (() => {
  const origin = String(process.env.CLIENT_URL || '').split(',')[0].trim().replace(/\/+$/, '');
  return /^https:\/\//.test(origin) ? `${origin}/logo-96.png` : '';
})();
const naira = (n) => `₦${Number(n || 0).toLocaleString('en-NG')}`;
const day = (d) => new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });

const layout = ({ heading, paragraphs = [], cta, note }) => `<!doctype html>
<html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr>${LOGO_URL ? `<td style="padding-right:10px"><img src="${LOGO_URL}" width="40" height="40" alt="" style="display:block;border:0;border-radius:10px"></td>` : ''}<td style="font-size:15px;font-weight:bold;color:#2563eb">EduPay</td></tr></table>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${esc(heading)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#374151">${p}</p>`).join('\n')}
${cta ? `<p style="margin:22px 0"><a href="${esc(cta.url)}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:bold;display:inline-block">${esc(cta.label)}</a></p>
<p style="margin:0 0 14px;font-size:12px;color:#6b7280;word-break:break-all">Or copy this link: ${esc(cta.url)}</p>` : ''}
${note ? `<p style="margin:18px 0 0;font-size:12px;color:#6b7280">${note}</p>` : ''}
</td></tr></table>
<p style="font-size:11px;color:#9ca3af;margin:14px 0 0">You received this because of activity on your EduPay account.</p>
</td></tr></table></body></html>`;

const build = ({ subject, heading, lines, cta, note }) => ({
  subject,
  html: layout({ heading, paragraphs: lines.map((l) => l.html), cta, note: note?.html }),
  text: [heading, '', ...lines.map((l) => l.text), ...(cta ? ['', `${cta.label}: ${cta.url}`] : []), ...(note ? ['', note.text] : []), '', '- EduPay'].join('\n'),
});
const L = (text, html) => ({ text, html: html ?? esc(text) });

const verifyEmail = ({ name, url }) => build({
  subject: 'Verify your EduPay email',
  heading: 'Confirm your email address',
  lines: [L(`Hi ${name || 'there'}, thanks for signing up. Confirm your email so we can reach you about your account.`, `Hi ${esc(name || 'there')}, thanks for signing up. Confirm your email so we can reach you about your account.`),
          L('This link works for 24 hours and can be used once.')],
  cta: { label: 'Verify my email', url },
  note: L('If you did not create an EduPay account, ignore this email.'),
});

const paymentReceipt = ({ parentName, school, p }) => {
  const money = (n) => naira(n);
  const manual = p.source === 'manual';
  const lines = [
    L(`Hi ${parentName || 'there'}, ${manual ? 'the school office recorded' : 'we received'} ${money(p.amountPaid)} for ${p.studentName} (${p.studentCode}) at ${school.name}.`,
      `Hi ${esc(parentName || 'there')}, ${manual ? 'the school office recorded' : 'we received'} <strong>${esc(money(p.amountPaid))}</strong> for ${esc(p.studentName)} (${esc(p.studentCode)}) at ${esc(school.name)}.`),
    L(`Applied to: ${p.feeLabel}. Amount applied to the fee: ${money(p.netAmountForSchool)}.${p.platformFee > 0 ? ` Service charge: ${money(p.platformFee)} (the school receives the full fee).` : ''}`,
      `Applied to: ${esc(p.feeLabel)}. Amount applied to the fee: <strong>${esc(money(p.netAmountForSchool))}</strong>.${p.platformFee > 0 ? ` Service charge: ${esc(money(p.platformFee))} (the school receives the full fee).` : ''}`),
  ];
  if (p.overpayment > 0) lines.push(L(`${money(p.overpayment)} more than the fee was received. Open EduPay to choose a refund or a credit toward the next fee.`));
  else if (p.balanceAfter > 0) lines.push(L(`Balance remaining: ${money(p.balanceAfter)} of ${money(p.amountExpected)}.`));
  else lines.push(L('This fee is now fully paid. Thank you.'));
  lines.push(L(`Reference: ${p.reference}. Date: ${day(p.processedAt || new Date())}.`));
  return build({ subject: `Payment received for ${p.studentName}`, heading: p.balanceAfter > 0 && !(p.overpayment > 0) ? 'Payment received' : 'Payment received, thank you', lines, cta: { label: 'Open EduPay', url: p.url } });
};

const feeDueReminder = ({ parentName, school, studentName, feeName, balance, dueDate, daysLeft, url }) => build({
  subject: daysLeft <= 1 ? `Fee due tomorrow for ${studentName}` : `Fee due in ${daysLeft} days for ${studentName}`,
  heading: daysLeft <= 1 ? 'A school fee is due tomorrow' : `A school fee is due in ${daysLeft} days`,
  lines: [
    L(`Hi ${parentName || 'there'}, ${feeName} for ${studentName} at ${school.name} is due on ${day(dueDate)}. Balance: ${naira(balance)}.`,
      `Hi ${esc(parentName || 'there')}, ${esc(feeName)} for ${esc(studentName)} at ${esc(school.name)} is due on <strong>${esc(day(dueDate))}</strong>. Balance: <strong>${esc(naira(balance))}</strong>.`),
    L("Pay by bank transfer to the student's EduPay account number, shown in the app."),
  ],
  cta: { label: 'Open EduPay', url },
});

const passwordReset = ({ name, url }) => build({
  subject: 'Reset your EduPay password',
  heading: 'Reset your password',
  lines: [L(`Hi ${name || 'there'}, we got a request to reset your EduPay password. Use the button below to choose a new one.`, `Hi ${esc(name || 'there')}, we got a request to reset your EduPay password. Use the button below to choose a new one.`),
          L('This link works for 1 hour and can be used once.')],
  cta: { label: 'Choose a new password', url },
  note: L('If you did not ask for this, ignore this email: your password has not changed.'),
});

const passwordChanged = ({ name }) => build({
  subject: 'Your EduPay password was changed',
  heading: 'Your password was changed',
  lines: [L(`Hi ${name || 'there'}, the password on your EduPay account was just changed, and any other signed-in devices were signed out.`, `Hi ${esc(name || 'there')}, the password on your EduPay account was just changed, and any other signed-in devices were signed out.`),
          L('If this was you, nothing more to do. If it was not, reset your password again straight away and contact EduPay.')],
});

const ownerNewApplication = ({ school, applicant, url, resubmitted }) => build({
  subject: `${resubmitted ? 'Updated school application' : 'New school application'}: ${school.name}`,
  heading: resubmitted ? 'A school resubmitted its application' : 'A school applied to join EduPay',
  lines: [
    L(`${school.name} (${school.address}).`, `<strong>${esc(school.name)}</strong> (${esc(school.address)}).`),
    L(`Applicant: ${applicant?.fullName || 'unknown'}, ${school.applicantPosition || 'position not given'}. School phone: ${school.phone || 'not given'}.`,
      `Applicant: ${esc(applicant?.fullName || 'unknown')}, ${esc(school.applicantPosition || 'position not given')}. School phone: ${esc(school.phone || 'not given')}.`),
    L('Verify the school before approving.'),
  ],
  cta: { label: 'Review application', url },
});

const applicationReceived = ({ name, school }) => build({
  subject: 'We received your EduPay application',
  heading: 'Your application is in',
  lines: [
    L(`Hi ${name}, we received the application for ${school.name}. EduPay verifies every school before it starts, usually with a phone call to a number we can confirm independently.`,
      `Hi ${esc(name)}, we received the application for <strong>${esc(school.name)}</strong>. EduPay verifies every school before it starts, usually with a phone call to a number we can confirm independently.`),
    L("We'll email you as soon as there is a decision. Until then you can sign in to follow your application."),
  ],
});

const applicationDecision = ({ status, name, school, text, url, pilotEndsAt }) => {
  const hi = (extra, extraHtml) => [L(`Hi ${name}, ${extra}`, `Hi ${esc(name)}, ${extraHtml ?? esc(extra)}`)];
  switch (status) {
    case 'approved': return build({
      subject: 'Your school is approved on EduPay', heading: `${school.name} is approved`,
      lines: [...hi(`${school.name} has been verified and approved. Your free pilot runs until ${day(pilotEndsAt)}.`, `<strong>${esc(school.name)}</strong> has been verified and approved. Your free pilot runs until <strong>${esc(day(pilotEndsAt))}</strong>.`),
              L('You can now enrol students, set up fees and save your payout account.')],
      cta: { label: 'Open EduPay', url } });
    case 'needs_info': return build({
      subject: 'EduPay needs more information about your school', heading: 'One more step',
      lines: [...hi('EduPay needs a little more information before approving your school:'), L(text, `<em>${esc(text)}</em>`)],
      cta: { label: 'Update and resubmit', url } });
    case 'rejected': return build({
      subject: 'Update on your EduPay application', heading: 'Your application was not approved',
      lines: [...hi(`we could not approve the application for ${school.name}.`, `we could not approve the application for <strong>${esc(school.name)}</strong>.`), L(`Reason: ${text}`, `Reason: <em>${esc(text)}</em>`),
              L('If you think this is a mistake, reply to EduPay with your school name and the phone number you registered.')] });
    case 'suspended': return build({
      subject: 'Your EduPay school account is suspended', heading: `${school.name} is suspended`,
      lines: [...hi('your school account has been suspended.'), L(`Reason: ${text}`, `Reason: <em>${esc(text)}</em>`),
              L('Parents can still pay and payments are still recorded. Contact EduPay to resolve this.')] });
    case 'reinstated': return build({
      subject: 'Your EduPay school account is active again', heading: `${school.name} is active again`,
      lines: [...hi('your school account has been reinstated. Everything works as before.')], cta: { label: 'Open EduPay', url } });
    default: return null;
  }
};

const subscriptionReceipt = ({ school, payment }) => build({
  subject: 'EduPay subscription payment received', heading: 'Payment received, thank you',
  lines: [
    L(`We recorded ${naira(payment.amount)} for ${school.name} (reference ${payment.reference}).`, `We recorded <strong>${esc(naira(payment.amount))}</strong> for ${esc(school.name)} (reference ${esc(payment.reference)}).`),
    L(`Your subscription now runs until ${day(payment.coversUntil)}.`, `Your subscription now runs until <strong>${esc(day(payment.coversUntil))}</strong>.`),
  ],
});

const subscriptionReminder = ({ kind, school, endDate, daysLeft, graceEndsAt, amountDue, payTo, url }) => {
  const how = payTo ? `Pay ${naira(amountDue)} to ${payTo.bank} ${payTo.accountNumber} (${payTo.accountName}) using your school name as the reference.` : `The amount due is ${naira(amountDue)}. Contact EduPay for the payment details.`;
  const copy = {
    '7d':     { subject: `Your EduPay subscription ends in ${daysLeft} days`, heading: `Subscription ends on ${day(endDate)}`, line: `Your EduPay subscription for ${school.name} ends on ${day(endDate)}. After that you have a grace period before new work pauses.` },
    '1d':     { subject: 'Your EduPay subscription ends tomorrow', heading: 'Subscription ends tomorrow', line: `Your EduPay subscription for ${school.name} ends on ${day(endDate)}.` },
    'grace':  { subject: 'Your EduPay subscription has ended', heading: 'Pay within the grace period', line: `Your subscription for ${school.name} ended on ${day(endDate)}. Everything still works until ${day(graceEndsAt)}. After that, enrolling students, fees and new staff pause.` },
    'locked': { subject: 'Your EduPay school is paused: subscription unpaid', heading: 'Your school is paused', line: `New work for ${school.name} is paused because the subscription ended on ${day(endDate)}. Parents can still pay and you can still withdraw and read reports. Pay to reopen at once.` },
  }[kind];
  if (!copy) return null;
  return build({ subject: copy.subject, heading: copy.heading, lines: [L(copy.line), L(how)], cta: { label: 'Open EduPay', url } });
};

module.exports = { esc, paymentReceipt, feeDueReminder, passwordReset, passwordChanged, verifyEmail, ownerNewApplication, applicationReceived, applicationDecision, subscriptionReceipt, subscriptionReminder };
