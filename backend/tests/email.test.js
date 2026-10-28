// Email verification and notifications, with the mail transport and database stubbed.
process.env.JWT_SECRET = 'test-secret';
process.env.MONGO_URI = 'mongodb://unused';
process.env.PLATFORM_ADMIN_EMAILS = 'owner@edupay.test';
process.env.CLIENT_URL = 'https://app.edupay.test';
process.env.VERCEL = '1'; // do not start real cron timers when requiring the jobs
delete process.env.SMTP_HOST;

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const User = require('../src/models/User');
const School = require('../src/models/School');
const Student = require('../src/models/Student');
const email = require('../src/services/email.service');
const { protect } = require('../src/middleware/auth.middleware');
const { clearApprovalCache } = require('../src/services/schoolApproval.service');
const { register, verifyEmail, resendVerification } = require('../src/controllers/auth.controller');
const emailVerification = require('../src/services/emailVerification.service');
const notify = require('../src/services/notify.service');
const { runSubscriptionReminders } = require('../src/jobs/subscriptionReminder.job');

const EmailOutbox = require('../src/models/EmailOutbox');
const realSend = email.sendEmail;
let outbox = [];
let queued = [];
test.beforeEach(() => {
  outbox = []; queued = [];
  email.sendEmail = async (m) => { outbox.push(m); return { sent: true }; };
  EmailOutbox.create = async (d) => { queued.push(d); return d; };   // no database in these tests
});

const fakeRes = () => { const r = { code: 200, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
const tokenFrom = (m) => m.text.match(/token=([a-f0-9]{64})/)[1];

test('sign-up creates an unverified account and emails a one-time link; only the hash is stored', async () => {
  let created = null; const stored = [];
  User.findOne = async () => null;
  User.create = async (d) => { created = d; return { _id: 'u1', fullName: d.fullName, email: d.email, toJSON: () => ({ ...d }) }; };
  User.updateOne = async (_f, update) => { stored.push(update.$set); return {}; };
  School.findById = () => ({ select: () => ({ lean: async () => null }) });
  const res = fakeRes();
  await register({ body: { fullName: 'Ada', email: 'Ada@School.test', password: 'longenough1', role: 'admin', acceptedTerms: true } }, res);
  assert.equal(res.code, 201);
  assert.equal(created.emailVerified, false);
  assert.equal(outbox.length, 1);
  assert.deepEqual([].concat(outbox[0].to), ['ada@school.test']);
  const raw = tokenFrom(outbox[0]);
  assert.match(outbox[0].text, /^.*Confirm your email/m);
  assert.ok(outbox[0].text.includes(`https://app.edupay.test/verify-email?token=${raw}`));
  assert.equal(stored[0].emailVerifyTokenHash, crypto.createHash('sha256').update(raw).digest('hex'));
  assert.notEqual(stored[0].emailVerifyTokenHash, raw, 'raw token is never stored');
  assert.ok(stored[0].emailVerifyExpires.getTime() > Date.now());
  assert.equal(res.body.data.verificationEmailSent, true);
});

test('sign-up still succeeds when the mail provider is down', async () => {
  User.findOne = async () => null;
  User.create = async (d) => ({ _id: 'u1', fullName: d.fullName, email: d.email, toJSON: () => ({ ...d }) });
  User.updateOne = async () => ({});
  School.findById = () => ({ select: () => ({ lean: async () => null }) });
  email.sendEmail = async () => ({ sent: false, reason: 'error' });
  const res = fakeRes();
  await register({ body: { fullName: 'Ada', email: 'a@b.test', password: 'longenough1', role: 'parent' } }, res);
  assert.equal(res.code, 201);
  assert.equal(res.body.data.verificationEmailSent, false);
});

const callProtect = async ({ user, method = 'POST', url = '/api/students' }) => {
  clearApprovalCache();
  User.findById = () => ({ select: async () => user });
  School.findById = () => ({ select: () => ({ lean: async () => ({ approval: { status: 'approved' } }) }) });
  const req = { headers: { authorization: `Bearer ${jwt.sign({ id: 'u1' }, process.env.JWT_SECRET)}` }, method, originalUrl: url };
  const res = fakeRes(); let passed = false;
  await protect(req, res, () => { passed = true; });
  return { passed, res };
};
const base = { role: 'admin', email: 'head@school.test', isActive: true, schoolId: 'a'.repeat(24) };

test('unverified users can only see their profile, resend the email and change password', async () => {
  const user = { ...base, emailVerified: false };
  for (const url of ['/api/students', '/api/schools', '/api/children', '/api/revenue/schools/x']) {
    const { passed, res } = await callProtect({ user, url });
    assert.equal(passed, false, url);
    assert.equal(res.code, 403);
    assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED');
  }
  for (const [method, url] of [['GET', '/api/auth/me'], ['POST', '/api/auth/resend-verification'], ['PATCH', '/api/auth/change-password']]) {
    assert.equal((await callProtect({ user, method, url })).passed, true, `${method} ${url}`);
  }
});

test('verified, legacy (no field) and platform-admin accounts are not blocked', async () => {
  assert.equal((await callProtect({ user: { ...base, emailVerified: true } })).passed, true);
  assert.equal((await callProtect({ user: { ...base } })).passed, true, 'legacy account');
  assert.equal((await callProtect({ user: { ...base, email: 'owner@edupay.test', emailVerified: false } })).passed, true);
});

test('verify-email: only a well-formed, known, unexpired token works, and only once', async () => {
  const good = 'a1'.repeat(32);
  let seenHash = null; let used = false;
  User.findOneAndUpdate = async (filter) => {
    seenHash = filter.emailVerifyTokenHash;
    if (used || seenHash !== crypto.createHash('sha256').update(good).digest('hex')) return null;
    used = true; return { _id: 'u1' };
  };
  const call = async (token) => { const res = fakeRes(); await verifyEmail({ body: { token } }, res); return res; };
  assert.equal((await call('')).code, 400);
  assert.equal((await call('not-hex')).code, 400);
  assert.equal((await call('b2'.repeat(32))).code, 400, 'unknown token');
  assert.equal((await call(good)).code, 200);
  assert.equal((await call(good)).code, 400, 'second use is refused');
});

test('resend: 60 second cooldown, no email for verified users', async () => {
  User.updateOne = async () => ({});
  const call = async (user) => { const res = fakeRes(); await resendVerification({ user }, res); return res; };
  const fresh = { _id: 'u1', email: 'a@b.test', fullName: 'A', emailVerified: false, emailVerifySentAt: new Date() };
  const tooSoon = await call(fresh);
  assert.equal(tooSoon.code, 429);
  assert.ok(tooSoon.body.retryAfter > 0);
  assert.equal(outbox.length, 0);
  const ok = await call({ ...fresh, emailVerifySentAt: new Date(Date.now() - 61000) });
  assert.equal(ok.code, 200);
  assert.equal(outbox.length, 1);
  outbox = [];
  await call({ ...fresh, emailVerified: true });
  await call({ _id: 'u2', email: 'old@b.test' });
  assert.equal(outbox.length, 0, 'verified and legacy users get nothing');
});

test('email.service: not configured means no crash and a clear result', async () => {
  const r = await realSend({ to: 'x@y.test', subject: 'Hi', html: '<p>x</p>', text: 'x' });
  assert.deepEqual(r, { sent: false, reason: 'not_configured' });
  assert.deepEqual(await realSend({ to: '', subject: 'Hi', text: 'x' }), { sent: false, reason: 'no_recipient' });
});

const school = { _id: 's1', name: '<script>alert(1)</script> Academy', address: '1 Main St', phone: '0801', applicantPosition: 'Proprietor', createdBy: 'u1', subscription: {} };

test('application submitted: receipt to the applicant, alert to the owner, user text escaped', async () => {
  await notify.applicationSubmitted(school, { fullName: 'Ada', email: 'ada@school.test' });
  assert.equal(outbox.length, 2);
  assert.deepEqual([].concat(outbox[0].to), ['ada@school.test']);
  assert.deepEqual([].concat(outbox[1].to), ['owner@edupay.test']);
  assert.ok(outbox[1].text.includes('https://app.edupay.test/admin/approvals'));
  for (const m of outbox) { assert.ok(!m.html.includes('<script>'), 'html is escaped'); assert.ok(m.html.includes('&lt;script&gt;')); }
});

test('decision emails go to the applicant, carry the reason, and never leak the internal note', async () => {
  User.findById = () => ({ select: () => ({ lean: async () => ({ email: 'ada@school.test', fullName: 'Ada' }) }) });
  const withNote = { ...school, name: 'Bright Academy', approval: { verificationNote: 'SECRET internal note' } };
  await notify.applicationDecided(withNote, 'approved', 'SECRET internal note', { pilotEndsAt: new Date('2027-03-01') });
  await notify.applicationDecided(withNote, 'rejected', 'We could not reach the school');
  await notify.applicationDecided(withNote, 'needs_info', 'Please add the proprietor name');
  await notify.applicationDecided(withNote, 'suspended', 'Chargeback dispute');
  assert.equal(outbox.length, 4);
  assert.ok(outbox.every((m) => [].concat(m.to)[0] === 'ada@school.test'));
  assert.ok(outbox[0].subject.includes('approved'));
  assert.ok(outbox[0].text.includes('March 2027'));
  assert.ok(!outbox[0].text.includes('SECRET'), 'approval email must not repeat the internal verification note');
  assert.ok(outbox[1].text.includes('We could not reach the school'));
  assert.ok(outbox[2].text.includes('Please add the proprietor name'));
  assert.ok(outbox[3].text.includes('Chargeback dispute'));
});

test('a failing mail provider never throws out of a notification', async () => {
  email.sendEmail = async () => { throw new Error('smtp exploded'); };
  User.findById = () => ({ select: () => ({ lean: async () => ({ email: 'a@b.test', fullName: 'A' }) }) });
  const r = await notify.applicationDecided(school, 'approved', 'x', { pilotEndsAt: new Date() });
  assert.equal(r.sent, false);
  assert.equal(queued.length, 1, 'the decision email is kept for a retry instead of being lost');
});

// ── Subscription reminders ───────────────────────────────────────────────────
const DAY = 86400000;
const mkSchool = (id, endsInDays, extra = {}) => ({
  _id: id, name: `School ${id}`, email: `${id}@x.test`, createdAt: new Date(Date.now() - 400 * DAY),
  subscription: { pilotEndsAt: new Date(Date.now() + endsInDays * DAY), paidUntil: null, peakStudents: 0, remindersSent: [], ...extra },
});

test('subscription reminders: right kind, once each, nothing for far-away or long-locked schools', async () => {
  const schools = [mkSchool('a', 5), mkSchool('b', 40), mkSchool('c', -2), mkSchool('d', -30), mkSchool('e', -9), mkSchool('f', 5, { extendedUntil: new Date(Date.now() + 5 * DAY) })];
  School.find = () => ({ select: () => ({ lean: async () => schools }) });
  Student.aggregate = async () => [{ _id: 'a', n: 120 }];
  User.find = () => ({ select: () => ({ lean: async () => ['a', 'c', 'e'].map((id) => ({ email: `admin-${id}@x.test`, fullName: id, schoolId: id })) }) });
  School.updateOne = async (f, u) => { const s = schools.find((x) => x._id === f._id); s.subscription.remindersSent.push(...u.$push['subscription.remindersSent'].$each); return {}; };

  const first = await runSubscriptionReminders();
  const byRecipient = Object.fromEntries(outbox.map((m) => [[].concat(m.to)[0], m]));
  assert.equal(first.sent, 3);
  assert.ok(byRecipient['admin-a@x.test'].subject.includes('ends in 5 days'));
  assert.ok(byRecipient['admin-a@x.test'].text.includes('₦36,000'), '120 students x 300');
  assert.ok(byRecipient['admin-c@x.test'].subject.includes('has ended'), 'grace');
  assert.ok(byRecipient['admin-e@x.test'].subject.includes('paused'), 'locked 2 days ago');
  assert.ok(!byRecipient['admin-b@x.test'] && !byRecipient['admin-d@x.test'], 'far away and long-locked get nothing');
  assert.ok(!outbox.some((m) => m.to.includes?.('f') ), 'extended schools get nothing');

  outbox = [];
  const second = await runSubscriptionReminders();
  assert.equal(second.sent, 0);
  assert.equal(outbox.length, 0, 'each reminder is sent once');
});

test('reminders are not recorded as sent when delivery fails, so they retry tomorrow', async () => {
  const s = mkSchool('a', 5);
  School.find = () => ({ select: () => ({ lean: async () => [s] }) });
  Student.aggregate = async () => [];
  User.find = () => ({ select: () => ({ lean: async () => [{ email: 'admin-a@x.test', fullName: 'a', schoolId: 'a' }] }) });
  School.updateOne = async () => { throw new Error('should not record'); };
  email.sendEmail = async () => ({ sent: false, reason: 'error' });
  const r = await runSubscriptionReminders();
  assert.equal(r.sent, 0);
});
