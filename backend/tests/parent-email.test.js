// Parent receipts and reminders, the email outbox, manual email verification (email-down fallback),
// the webhook acknowledgement order on serverless, and the provisioning backfill. No database or mail server.
process.env.JWT_SECRET = 'test-secret';
process.env.MONGO_URI = 'mongodb://unused';
process.env.PLATFORM_ADMIN_EMAILS = 'owner@edupay.test';
process.env.CLIENT_URL = 'https://app.edupay.test';
process.env.EMAIL_SEND_DEADLINE_MS = '50';
process.env.VERCEL = '1';
delete process.env.SMTP_HOST;

const test = require('node:test');
const assert = require('node:assert/strict');

const User = require('../src/models/User');
const School = require('../src/models/School');
const Student = require('../src/models/Student');
const FeeAssignment = require('../src/models/FeeAssignment');
const AuditLog = require('../src/models/AuditLog');
const EmailOutbox = require('../src/models/EmailOutbox');
const { WebhookLog } = require('../src/models/WebhookLog');
const email = require('../src/services/email.service');
const notify = require('../src/services/notify.service');
const outboxService = require('../src/services/outbox.service');
const notificationService = require('../src/services/notification.service');
const reconciliation = require('../src/services/reconciliation.service');
const virtualAccounts = require('../src/services/virtualAccount.service');

let sent = [];
let queued = [];
test.beforeEach(() => {
  sent = []; queued = [];
  email.sendEmail = async (m) => { sent.push(m); return { sent: true }; };
  EmailOutbox.create = async (d) => { queued.push(d); return d; };
  AuditLog.create = async () => ({});
});

const chain = (value) => { const c = { select: () => c, sort: () => c, limit: () => c, populate: () => c, lean: async () => value, then: (res, rej) => Promise.resolve(value).then(res, rej) }; return c; };
const fakeRes = () => { const r = { code: 200, body: null, headersSent: false, events: [] }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; r.headersSent = true; r.events?.push('acked'); return r; }; return r; };

// ── Parent payment receipts ──────────────────────────────────────────────────
const parent = { _id: 'p1', email: 'mum@x.test', fullName: 'Mrs Okeke', isActive: true, emailVerified: true };
const student = { _id: 'st1', parentId: 'p1', schoolId: 's1' };
const base = { studentName: 'Chidi Okeke', studentCode: 'STU001', feeName: 'First Term Fees', reference: 'REF-1', processedAt: new Date('2026-10-20'),
  source: 'webhook', amountExpected: 50000, overpayment: 0, balanceAfter: 0, amountPaid: 50863, netAmountForSchool: 50000, platformFee: 863 };
const stubLookups = (p = parent) => {
  User.findById = () => chain(p);
  School.findById = () => chain({ name: 'Bright Academy' });
};

test('receipt: exact payment says fully paid, shows the service charge and that the school gets the full fee', async () => {
  stubLookups();
  await notify.paymentReceived(base, student);
  assert.equal(sent.length, 1);
  assert.deepEqual([].concat(sent[0].to), ['mum@x.test']);
  assert.equal(sent[0].subject, 'Payment received for Chidi Okeke');
  const t = sent[0].text;
  assert.ok(t.includes('₦50,863') && t.includes('₦50,000') && t.includes('₦863'));
  assert.ok(t.includes('school receives the full fee'));
  assert.ok(t.includes('fully paid') && t.includes('REF-1') && t.includes('Bright Academy'));
  assert.ok(t.includes('https://app.edupay.test/login'));
});

test('receipt: underpayment shows the balance; overpayment tells the parent to choose a refund or credit', async () => {
  stubLookups();
  await notify.paymentReceived({ ...base, amountPaid: 20406, netAmountForSchool: 20000, platformFee: 406, balanceAfter: 30000 }, student);
  assert.ok(sent[0].text.includes('Balance remaining: ₦30,000 of ₦50,000'));
  await notify.paymentReceived({ ...base, overpayment: 5000, reference: 'REF-2' }, student);
  assert.ok(sent[1].text.includes('₦5,000 more than the fee') && sent[1].text.includes('refund or a credit'));
});

test('receipt: cash recorded by the office has no service charge line', async () => {
  stubLookups();
  await notify.paymentReceived({ ...base, source: 'manual', amountPaid: 10000, netAmountForSchool: 10000, platformFee: 0, balanceAfter: 40000 }, student);
  assert.ok(sent[0].text.includes('the school office recorded'));
  assert.ok(!sent[0].text.includes('Service charge'));
});

test('receipt: nothing is sent without a linked, active, verified parent; names are escaped', async () => {
  await notify.paymentReceived(base, { ...student, parentId: null });
  stubLookups({ ...parent, emailVerified: false });
  await notify.paymentReceived(base, student);
  stubLookups({ ...parent, isActive: false });
  await notify.paymentReceived(base, student);
  stubLookups(null);
  await notify.paymentReceived(base, student);
  assert.equal(sent.length, 0);
  stubLookups({ ...parent, emailVerified: undefined });   // legacy account counts as verified
  await notify.paymentReceived({ ...base, studentName: '<img src=x> Kid' }, student);
  assert.equal(sent.length, 1);
  // the injected tag must be escaped; the only real <img> is the EduPay logo in the header
  assert.ok(!sent[0].html.includes('<img src=x') && sent[0].html.includes('&lt;img src=x'));
  assert.ok(sent[0].html.includes('https://app.edupay.test/logo-96.png'));
});

// ── Fee due reminders by email ───────────────────────────────────────────────
test('fee reminders: emails verified parents only, with balance and due date', async () => {
  const due = (id, parentId, name) => ({ schoolId: 's1', balance: 30000, studentId: { fullName: name, parentId }, feeStructureId: { name: 'First Term Fees', dueDate: new Date('2026-11-03') } });
  notificationService.createDueDateReminders = async () => {};
  FeeAssignment.find = () => chain([due(1, 'p1', 'Chidi'), due(2, 'p2', 'Ada'), due(3, null, 'Obi')]);
  User.find = () => chain([parent, { _id: 'p2', email: 'unverified@x.test', fullName: 'X', isActive: true, emailVerified: false }]);
  School.find = () => chain([{ _id: 's1', name: 'Bright Academy' }]);
  const { sendReminders } = require('../src/jobs/feeReminder.job');
  await sendReminders(3);
  assert.equal(sent.length, 1);
  assert.deepEqual([].concat(sent[0].to), ['mum@x.test']);
  assert.equal(sent[0].subject, 'Fee due in 3 days for Chidi');
  assert.ok(sent[0].text.includes('₦30,000') && sent[0].text.includes('November 2026'));
});

// ── Outbox: never lose an email that matters ─────────────────────────────────
test('outbox: a failed or slow send is queued for retry; success and "not configured" are not', async () => {
  const msg = { to: 'a@x.test', subject: 'Hi', html: '<p>x</p>', text: 'x' };
  assert.equal((await outboxService.sendReliably(msg, 'receipt')).sent, true);
  assert.equal(queued.length, 0);

  email.sendEmail = async () => ({ sent: false, reason: 'error' });
  const failed = await outboxService.sendReliably(msg, 'receipt');
  assert.equal(failed.queued, true);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].kind, 'receipt');
  assert.ok(queued[0].nextAttemptAt.getTime() > Date.now());

  email.sendEmail = () => new Promise(() => {});            // provider hangs: we give up quickly and queue
  const started = Date.now();
  const slow = await outboxService.sendReliably(msg);
  assert.equal(slow.queued, true);
  assert.ok(Date.now() - started < 1000, 'a hanging provider cannot hold the caller');
  assert.equal(queued.length, 2);

  email.sendEmail = async () => ({ sent: false, reason: 'not_configured' });
  await outboxService.sendReliably(msg);
  assert.equal(queued.length, 2, 'nothing to retry when email is simply not configured');
});

test('outbox flush: retries, marks sent, backs off, and gives up after 5 attempts', async () => {
  const mk = (id, attempts) => ({ _id: id, to: ['a@x.test'], subject: 'S', html: 'h', text: 't', attempts, nextAttemptAt: new Date(0), status: 'pending' });
  const items = [mk('ok', 1), mk('retry', 1), mk('last', 4)];
  const updates = {};
  EmailOutbox.find = () => ({ sort: () => ({ limit: async () => items }) });
  EmailOutbox.updateOne = async (f, u) => { if (u.$set.nextAttemptAt && !u.$set.status && !u.$set.attempts) return { modifiedCount: 1 }; updates[f._id] = u.$set; return { modifiedCount: 1 }; };
  EmailOutbox.updateMany = async () => ({});
  let n = 0;
  email.sendEmail = async () => (n++ === 0 ? { sent: true } : { sent: false, reason: 'error' });   // first succeeds, rest fail
  const out = await outboxService.flushOutbox(Date.now());
  assert.deepEqual(out, { sent: 1, retrying: 1, failed: 1 });
  assert.equal(updates.ok.status, 'sent');
  assert.equal(updates.retry.attempts, 2);
  assert.ok(updates.retry.nextAttemptAt.getTime() > Date.now(), 'backs off');
  assert.equal(updates.last.status, 'failed', 'the fifth failure is final');
});

// ── Email down: the owner can still move people forward ──────────────────────
const { listUnverifiedSignups, verifyEmailManually } = require('../src/controllers/approval.controller');
const call = async (handler, req) => { const res = fakeRes(); await handler({ user: { _id: 'owner' }, params: {}, query: {}, body: {}, ...req }, res); return res; };

test('manual verification: needs a note, only works on unverified accounts, clears the token, is audited', async () => {
  const audit = []; AuditLog.create = async (d) => { audit.push(d); };
  const unverified = { _id: 'a'.repeat(24), fullName: 'Ada', email: 'ada@school.test', role: 'admin', emailVerified: false };
  let updated = null;
  User.findById = () => ({ select: async () => unverified });
  User.updateOne = async (f, u) => { updated = u; return {}; };
  const id = unverified._id;

  assert.equal((await call(verifyEmailManually, { params: { userId: id }, body: { note: 'ok' } })).code, 400, 'note too short');
  assert.equal((await call(verifyEmailManually, { params: { userId: 'nope' }, body: { note: 'Confirmed by phone call' } })).code, 404, 'bad id');
  User.findById = () => ({ select: async () => null });
  assert.equal((await call(verifyEmailManually, { params: { userId: id }, body: { note: 'Confirmed by phone call' } })).code, 404);
  User.findById = () => ({ select: async () => ({ ...unverified, emailVerified: true }) });
  assert.equal((await call(verifyEmailManually, { params: { userId: id }, body: { note: 'Confirmed by phone call' } })).code, 400, 'already verified');
  User.findById = () => ({ select: async () => ({ ...unverified, email: 'owner@edupay.test' }) });
  assert.equal((await call(verifyEmailManually, { params: { userId: id }, body: { note: 'Confirmed by phone call' } })).code, 400, 'owner account');
  assert.equal(updated, null, 'nothing was changed by any refused request');

  User.findById = () => ({ select: async () => unverified });
  const ok = await call(verifyEmailManually, { params: { userId: id }, body: { note: 'Confirmed by phone call, mail provider down' } });
  assert.equal(ok.code, 200);
  assert.equal(updated.$set.emailVerified, true);
  assert.deepEqual(Object.keys(updated.$unset).sort(), ['emailVerifyExpires', 'emailVerifyTokenHash']);
  assert.equal(audit[0].action, 'email_verify_manual');
  assert.equal(audit[0].actorId, 'owner');
  assert.ok(audit[0].meta.note.includes('mail provider down'));
});

test('unverified sign-up list: asks only for unverified, active accounts of the chosen role, and reports mail status', async () => {
  let filter = null;
  User.find = (f) => { filter = f; return chain([{ fullName: 'Ada', email: 'ada@school.test', role: 'admin' }]); };
  User.countDocuments = async (f) => (f.role === 'admin' ? 3 : 7);
  const res = await call(listUnverifiedSignups, { query: {} });
  assert.deepEqual(filter, { role: 'admin', emailVerified: false, isActive: true });
  assert.deepEqual(res.body.data.counts, { admin: 3, parent: 7 });
  assert.equal(res.body.data.emailConfigured, false);
  await call(listUnverifiedSignups, { query: { role: 'parent' } });
  assert.equal(filter.role, 'parent');
  await call(listUnverifiedSignups, { query: { role: 'superadmin' } });
  assert.equal(filter.role, 'admin', 'unknown roles fall back to admin');
});

// ── Webhook: on serverless, process first and acknowledge after ──────────────
test('webhook: serverless acknowledges only after the payment is processed; a normal host acknowledges first', async () => {
  const events = [];
  reconciliation.processPayment = async () => { await new Promise((r) => setTimeout(r, 20)); events.push('processed'); return { skipped: false }; };
  virtualAccounts.findStudentByAccountNumber = async () => ({ schoolId: 's1' });
  WebhookLog.create = async () => ({ save: async () => {} });
  delete require.cache[require.resolve('../src/controllers/webhook.controller')];
  const { handleNombaWebhook } = require('../src/controllers/webhook.controller');
  const req = { headers: {}, app: { locals: {} }, body: { event_type: 'payment_success', data: { transaction: { type: 'vact_transfer', aliasAccountNumber: '1234567890', transactionAmount: 1000, transactionId: 'T-1' } } } };
  const run = async () => { const res = fakeRes(); res.json = (b) => { res.headersSent = true; events.push('acked'); return res; }; await handleNombaWebhook(req, res); return res; };

  process.env.VERCEL = '1';
  const vercel = await run();
  assert.deepEqual(events, ['processed', 'acked']);
  assert.equal(vercel.code, 200);

  events.length = 0; delete process.env.VERCEL;
  await run();
  assert.deepEqual(events, ['acked', 'processed']);
  process.env.VERCEL = '1';
});

test('webhook: a processing crash still gets a 200 (the log keeps it replayable) and never a hang', async () => {
  reconciliation.processPayment = async () => { throw new Error('db down'); };
  WebhookLog.create = async () => ({ save: async () => {} });
  delete require.cache[require.resolve('../src/controllers/webhook.controller')];
  const { handleNombaWebhook } = require('../src/controllers/webhook.controller');
  const res = fakeRes();
  await handleNombaWebhook({ headers: {}, app: { locals: {} }, body: { event_type: 'payment_success', data: { transaction: { type: 'vact_transfer', aliasAccountNumber: '1', transactionAmount: 1, transactionId: 'T-2' } } } }, res);
  assert.equal(res.code, 200);
});

// ── Provisioning backfill ────────────────────────────────────────────────────
test('provisioning backfill: finds students with no account, counts outcomes, respects the time budget', async () => {
  const { runProvisioningBackfill } = require('../src/services/provisionBackfill.service');
  let filter = null;
  const students = [{ studentId: 'A' }, { studentId: 'B' }, { studentId: 'C' }];
  Student.find = (f) => { filter = f; return chain(students); };
  const outcomes = [{ errors: [] }, new Error('boom'), { errors: ['nomba down', 'paystack down'] }];
  let i = 0;
  virtualAccounts.provisionStudentVirtualAccount = async () => { const o = outcomes[i++]; if (o instanceof Error) throw o; return o; };
  const out = await runProvisioningBackfill({ delayMs: 0 });
  assert.deepEqual(out, { attempted: 3, provisioned: 1, failed: 2 });
  assert.equal(filter.isActive, true);
  assert.equal(filter['virtualAccounts.nomba.accountNumber'], null);
  assert.equal(filter['virtualAccounts.paystack.accountNumber'], null);
  i = 0;
  assert.equal((await runProvisioningBackfill({ delayMs: 0, budgetMs: -1 })).attempted, 0, 'stops at the budget');
});
