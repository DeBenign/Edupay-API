// Proves the approval rules without a database: models are stubbed, middleware and controllers are real.
process.env.JWT_SECRET = 'test-secret';
process.env.MONGO_URI = 'mongodb://unused';
process.env.PLATFORM_ADMIN_EMAILS = 'owner@edupay.test';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const User = require('../src/models/User');
const School = require('../src/models/School');
const AuditLog = require('../src/models/AuditLog');
const { protect } = require('../src/middleware/auth.middleware');
const { clearApprovalCache } = require('../src/services/schoolApproval.service');
const { register } = require('../src/controllers/auth.controller');
const { approveSchool, rejectSchool, requestInfo, suspendSchool, reinstateSchool, resubmitApplication } = require('../src/controllers/approval.controller');

AuditLog.create = async () => ({});
// No real email or database writes in these tests
const email = require('../src/services/email.service');
email.sendEmail = async () => ({ sent: true });
User.updateOne = async () => ({});
const notify = require('../src/services/notify.service');
notify.applicationDecided = async () => ({ sent: true });
notify.applicationResubmitted = async () => ({ sent: true });

const SCHOOL_ID = 'a'.repeat(24);
const fakeRes = () => { const r = { code: 200, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

// protect() with a given user + school state, for a given request
const callProtect = async ({ user, school, method = 'POST', url = '/api/students' }) => {
  clearApprovalCache();
  User.findById = () => ({ select: async () => user });
  School.findById = () => ({ select: () => ({ lean: async () => school }) });
  const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${token}` }, method, originalUrl: url };
  const res = fakeRes(); let passed = false;
  await protect(req, res, () => { passed = true; });
  return { passed, res };
};
const admin  = { role: 'admin',  email: 'head@school.test', isActive: true, schoolId: SCHOOL_ID };
const bursar = { role: 'bursar', email: 'bursar@school.test', isActive: true, schoolId: SCHOOL_ID };

test('pending school admin cannot reach operational APIs', async () => {
  for (const url of ['/api/students', '/api/fees/assignments', '/api/withdrawals', '/api/revenue/schools/' + SCHOOL_ID]) {
    const { passed, res } = await callProtect({ user: admin, school: { approval: { status: 'pending' } }, url });
    assert.equal(passed, false, url);
    assert.equal(res.code, 403);
    assert.equal(res.body.code, 'SCHOOL_PENDING');
  }
});

test('pending school admin can still see status, fix the application and change password', async () => {
  const allowed = [['GET', '/api/auth/me'], ['PATCH', '/api/auth/change-password'], ['GET', '/api/schools/me'],
    ['PATCH', '/api/schools/' + SCHOOL_ID], ['POST', '/api/schools/my/resubmit']];
  for (const [method, url] of allowed) {
    const { passed } = await callProtect({ user: admin, school: { approval: { status: 'pending' } }, method, url });
    assert.equal(passed, true, `${method} ${url}`);
  }
});

test('rejected, needs_info and suspended schools are blocked; bursars too', async () => {
  for (const status of ['rejected', 'needs_info', 'suspended']) {
    for (const user of [admin, bursar]) {
      const { passed, res } = await callProtect({ user, school: { approval: { status } } });
      assert.equal(passed, false, `${user.role} ${status}`);
      assert.equal(res.body.code, `SCHOOL_${status.toUpperCase()}`);
    }
  }
});

test('approved schools and legacy schools (no approval field) pass', async () => {
  assert.equal((await callProtect({ user: admin, school: { approval: { status: 'approved' } } })).passed, true);
  assert.equal((await callProtect({ user: admin, school: {} })).passed, true);
  assert.equal((await callProtect({ user: bursar, school: { approval: { status: 'approved' } } })).passed, true);
});

test('platform admin and parents are never blocked by school approval', async () => {
  const owner = { role: 'admin', email: 'owner@edupay.test', isActive: true, schoolId: SCHOOL_ID };
  assert.equal((await callProtect({ user: owner, school: { approval: { status: 'suspended' } } })).passed, true);
  const parent = { role: 'parent', email: 'p@x.test', isActive: true, schoolId: null };
  assert.equal((await callProtect({ user: parent, school: null })).passed, true);
});

test('registration: no public bursar or reserved platform-admin email, strong password, terms for school admins', async () => {
  let created = null;
  User.findOne = async () => null;
  User.create = async (d) => { created = d; return { _id: 'n1', toJSON: () => ({ ...d }) }; };
  const call = async (body) => { const res = fakeRes(); await register({ body }, res); return res; };
  const ok = { fullName: 'A B', email: 'New@School.test', password: 'longenough1', role: 'admin', acceptedTerms: true };

  assert.equal((await call({ ...ok, role: 'bursar' })).code, 400);
  assert.equal((await call({ ...ok, role: 'superadmin' })).code, 400);
  assert.equal((await call({ ...ok, email: 'Owner@EduPay.test' })).code, 403);
  assert.equal((await call({ ...ok, password: 'short' })).code, 400);
  assert.equal((await call({ ...ok, acceptedTerms: false })).code, 400);
  assert.equal(created, null, 'nothing was created by any rejected request');

  School.findById = () => ({ select: () => ({ lean: async () => null }) });
  const good = await call(ok);
  assert.equal(good.code, 201);
  assert.equal(created.email, 'new@school.test');
  assert.ok(created.termsAcceptedAt instanceof Date);
  assert.equal((await call({ ...ok, role: 'parent', acceptedTerms: undefined })).code, 201);
});

// ── Decisions ────────────────────────────────────────────────────────────────
const makeSchool = (status) => {
  const s = { _id: SCHOOL_ID, approval: status ? { status, history: [] } : undefined, subscription: { pilotEndsAt: new Date(0) }, saved: 0 };
  s.save = async () => { s.saved++; };
  return s;
};
const decide = async (handler, school, body) => {
  School.findById = async () => school;
  const res = fakeRes();
  await handler({ params: { id: SCHOOL_ID }, body, user: { _id: 'owner' } }, res);
  return res;
};

test('approve needs a verification note AND the call confirmation; starts the pilot', async () => {
  const s = makeSchool('pending');
  assert.equal((await decide(approveSchool, s, { verifiedByCall: true })).code, 400);
  assert.equal((await decide(approveSchool, s, { verificationNote: 'Called the principal on the school line' })).code, 400);
  assert.equal(s.saved, 0);
  const res = await decide(approveSchool, s, { verificationNote: 'Called the principal on the school line', verifiedByCall: true });
  assert.equal(res.code, 200);
  assert.equal(s.approval.status, 'approved');
  assert.ok(s.subscription.pilotEndsAt.getTime() > Date.now() + 100 * 86400000, 'pilot restarts at approval');
  assert.equal(s.approval.history.at(-1).status, 'approved');
});

test('state machine: no approving an approved school, reject needs a reason, suspend only approved', async () => {
  assert.equal((await decide(approveSchool, makeSchool('approved'), { verificationNote: 'xxxxxx', verifiedByCall: true })).code, 400);
  assert.equal((await decide(approveSchool, makeSchool('rejected'), { verificationNote: 'xxxxxx', verifiedByCall: true })).code, 400);
  assert.equal((await decide(rejectSchool, makeSchool('pending'), {})).code, 400);
  const rej = makeSchool('pending');
  assert.equal((await decide(rejectSchool, rej, { reason: 'Could not reach the school' })).code, 200);
  assert.equal(rej.approval.status, 'rejected');
  assert.equal(rej.approval.reason, 'Could not reach the school');
  assert.equal((await decide(suspendSchool, makeSchool('pending'), { reason: 'testing it' })).code, 400);
  const sus = makeSchool('approved');
  assert.equal((await decide(suspendSchool, sus, { reason: 'Chargeback dispute' })).code, 200);
  assert.equal(sus.approval.status, 'suspended');
  assert.equal((await decide(reinstateSchool, sus, {})).code, 200);
  assert.equal(sus.approval.status, 'approved');
});

test('reinstating a suspended school does not hand out a fresh pilot', async () => {
  const s = makeSchool('suspended');
  const before = s.subscription.pilotEndsAt;
  await decide(reinstateSchool, s, {});
  assert.equal(s.subscription.pilotEndsAt, before);
});

test('request-info then applicant resubmit returns it to the queue', async () => {
  const s = makeSchool('pending');
  assert.equal((await decide(requestInfo, s, { message: 'Please add the proprietor name' })).code, 200);
  assert.equal(s.approval.status, 'needs_info');
  School.findOne = async () => s;
  const res = fakeRes();
  await resubmitApplication({ user: { _id: 'u1', schoolId: SCHOOL_ID } }, res);
  assert.equal(res.code, 200);
  assert.equal(s.approval.status, 'pending');
  // a pending school cannot "resubmit"
  const again = fakeRes();
  await resubmitApplication({ user: { _id: 'u1', schoolId: SCHOOL_ID } }, again);
  assert.equal(again.code, 400);
});
