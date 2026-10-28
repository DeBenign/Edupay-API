// Forgot / reset password, with the database and mail transport stubbed.
process.env.JWT_SECRET = 'test-secret';
process.env.MONGO_URI = 'mongodb://unused';
process.env.PLATFORM_ADMIN_EMAILS = 'owner@edupay.test';
process.env.CLIENT_URL = 'https://app.edupay.test';
process.env.VERCEL = '1';
delete process.env.SMTP_HOST;

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const User = require('../src/models/User');
const School = require('../src/models/School');
const email = require('../src/services/email.service');
const { protect } = require('../src/middleware/auth.middleware');
const { clearApprovalCache } = require('../src/services/schoolApproval.service');
const { forgotPassword, resetPassword } = require('../src/controllers/auth.controller');

let outbox = [];
test.beforeEach(() => { outbox = []; email.sendEmail = async (m) => { outbox.push(m); return { sent: true }; }; });
const fakeRes = () => { const r = { code: 200, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const tokenFrom = (m) => m.text.match(/token=([a-f0-9]{64})/)[1];
const forgot = async (body) => { const res = fakeRes(); await forgotPassword({ body }, res); return res; };
const reset = async (body) => { const res = fakeRes(); await resetPassword({ body }, res); return res; };

test('forgot-password: the reply is identical whether or not the account exists, and unknown emails get no mail', async () => {
  User.updateOne = async () => ({});
  User.findOne = async () => null;
  const unknown = await forgot({ email: 'nobody@x.test' });
  User.findOne = async () => ({ _id: 'u1', email: 'ada@x.test', fullName: 'Ada', isActive: true });
  const known = await forgot({ email: 'ada@x.test' });
  assert.equal(unknown.code, 200);
  assert.equal(known.code, 200);
  assert.deepEqual(unknown.body, known.body, 'no way to tell the two apart');
  assert.equal(outbox.length, 1, 'only the real account was emailed');
});

test('forgot-password: link is emailed, only the hash is stored, expiry is about an hour', async () => {
  let stored;
  User.updateOne = async (_f, u) => { stored = u.$set; return {}; };
  User.findOne = async (q) => ({ _id: 'u1', email: q.email, fullName: 'Ada', isActive: true });
  await forgot({ email: ' Ada@X.test ' });
  assert.equal(outbox.length, 1);
  assert.deepEqual([].concat(outbox[0].to), ['ada@x.test']);
  const raw = tokenFrom(outbox[0]);
  assert.ok(outbox[0].text.includes(`https://app.edupay.test/reset-password?token=${raw}`));
  assert.equal(stored.passwordResetTokenHash, sha(raw));
  assert.notEqual(stored.passwordResetTokenHash, raw);
  const mins = (stored.passwordResetExpires.getTime() - Date.now()) / 60000;
  assert.ok(mins > 55 && mins <= 60, `expires in ${mins} minutes`);
});

test('forgot-password: 60 second cooldown, deactivated accounts and bad input', async () => {
  User.updateOne = async () => ({});
  User.findOne = async () => ({ _id: 'u1', email: 'a@x.test', fullName: 'A', isActive: true, passwordResetSentAt: new Date() });
  assert.equal((await forgot({ email: 'a@x.test' })).code, 200);
  assert.equal(outbox.length, 0, 'asked again within a minute: still 200, no second email');
  User.findOne = async () => ({ _id: 'u2', email: 'off@x.test', fullName: 'Off', isActive: false });
  await forgot({ email: 'off@x.test' });
  assert.equal(outbox.length, 0, 'deactivated accounts get nothing');
  assert.equal((await forgot({ email: '' })).code, 400);
  assert.equal((await forgot({ email: 'no-at-sign' })).code, 400);
});

test('reset-password: validates input before touching the token', async () => {
  let claimed = 0;
  User.findOneAndUpdate = async () => { claimed++; return null; };
  assert.equal((await reset({ token: 'short', password: 'longenough1' })).code, 400);
  assert.equal((await reset({ token: 'a1'.repeat(32), password: 'short' })).code, 400);
  assert.equal(claimed, 0, 'a typo in the password never burns the link');
});

test('reset-password: works once, sets the new password, signs out old sessions, tells the user', async () => {
  const good = 'c3'.repeat(32);
  let used = false, seen = null;
  const fake = { _id: 'u1', email: 'ada@x.test', fullName: 'Ada', password: 'old', mustChangePassword: true, emailVerified: false, saved: 0, save: async function () { this.saved++; } };
  User.findOneAndUpdate = async (filter, update) => {
    seen = { filter, update };
    if (used || filter.passwordResetTokenHash !== sha(good)) return null;
    used = true; return fake;
  };
  const ok = await reset({ token: good, password: 'brand-new-pass' });
  assert.equal(ok.code, 200);
  assert.equal(seen.filter.passwordResetTokenHash, sha(good));
  assert.ok(seen.filter.passwordResetExpires.$gt instanceof Date, 'expiry is enforced in the query');
  assert.equal(seen.filter.isActive, true);
  assert.deepEqual(Object.keys(seen.update.$unset).sort(), ['passwordResetExpires', 'passwordResetTokenHash']);
  assert.equal(fake.password, 'brand-new-pass');
  assert.equal(fake.mustChangePassword, false);
  assert.equal(fake.emailVerified, true, 'owning the inbox counts as verifying it');
  assert.ok(fake.passwordChangedAt instanceof Date);
  assert.equal(fake.saved, 1);
  assert.equal(outbox.length, 1);
  assert.ok(outbox[0].subject.includes('password was changed'));
  assert.equal((await reset({ token: good, password: 'another-pass-1' })).code, 400, 'second use refused');
  assert.equal((await reset({ token: 'd4'.repeat(32), password: 'another-pass-1' })).code, 400, 'unknown token refused');
});

test('sessions issued before a password reset stop working; newer ones work', async () => {
  const changedAt = new Date();
  const user = { role: 'parent', email: 'p@x.test', isActive: true, schoolId: null, passwordChangedAt: changedAt };
  const call = async (iat) => {
    clearApprovalCache();
    User.findById = () => ({ select: async () => user });
    School.findById = () => ({ select: () => ({ lean: async () => null }) });
    const token = jwt.sign({ id: 'u1', iat }, process.env.JWT_SECRET);
    const res = fakeRes(); let passed = false;
    await protect({ headers: { authorization: `Bearer ${token}` }, method: 'GET', originalUrl: '/api/children' }, res, () => { passed = true; });
    return { passed, res };
  };
  const now = Math.floor(changedAt.getTime() / 1000);
  const old = await call(now - 3600);
  assert.equal(old.passed, false);
  assert.equal(old.res.code, 401);
  assert.equal((await call(now)).passed, true, 'a session started right after the reset is fine');
  assert.equal((await call(now + 5)).passed, true);
});
