// Fee reminders: before the due date, after it (weekly, capped), dedupe, SMS opt-in, and the bursar's "Remind now".
// No database, mail server or SMS provider: models and senders are replaced in memory.
process.env.JWT_SECRET = 'test-secret';
process.env.MONGO_URI = 'mongodb://unused';
process.env.CLIENT_URL = 'https://app.edupay.test';
process.env.VERCEL = '1';
process.env.TERMII_API_KEY = 'k'; process.env.TERMII_SENDER_ID = 'EduPay';
delete process.env.SMTP_HOST;

const test = require('node:test');
const assert = require('node:assert/strict');
const FeeAssignment = require('../src/models/FeeAssignment');
const FeeStructure = require('../src/models/FeeStructure');
const Student = require('../src/models/Student');
const User = require('../src/models/User');
const School = require('../src/models/School');
const ReminderLog = require('../src/models/ReminderLog');
const { Notification } = require('../src/models/WebhookLog');
const notify = require('../src/services/notify.service');
const sms = require('../src/services/sms.service');
const svc = require('../src/services/feeReminder.service');

const DAY = 86400000;
const chain = (value) => { const c = { select: () => c, sort: () => c, limit: () => c, lean: async () => value, then: (res, rej) => Promise.resolve(value).then(res, rej) }; return c; };
const at = (n) => new Date(svc.dayStart(new Date()).getTime() + n * DAY);          // Lagos midnight n days from today

let notes, logs, emails, texts, bulk, queries;
const parent = { _id: 'p1', email: 'mum@x.test', fullName: 'Mrs Okeke', phone: '08031234567', isActive: true, emailVerified: true };
const student = { _id: 'st1', fullName: 'Chidi Okeke', parentId: 'p1', schoolId: 's1' };
let school;
const asg = (extra = {}) => ({ _id: 'a1', studentId: 'st1', schoolId: 's1', feeStructureId: 'f1', balance: 30000, status: 'unpaid', reminders: {}, ...extra });

const wire = ({ fee, assignments = [asg()], par = parent, stu = student }) => {
  FeeStructure.find = (q) => { queries.fee = q; return chain([fee]); };
  FeeAssignment.find = (q) => { queries.asg = q; return chain(assignments); };
  Student.find = () => chain([stu]);
  User.find = () => chain(par ? [par] : []);
  School.find = () => chain([school]);
};

test.beforeEach(() => {
  notes = []; logs = []; emails = []; texts = []; bulk = []; queries = {};
  school = { _id: 's1', name: 'Bright Academy', createdAt: new Date(), reminders: { overdueEnabled: true, smsEnabled: false } };
  Notification.create = async (n) => { notes.push(n); return n; };
  ReminderLog.insertMany = async (rows) => { logs.push(...rows); return rows; };
  FeeAssignment.bulkWrite = async (ops) => { bulk.push(...ops); return {}; };
  notify.feeDueReminder = async (p, ctx) => { emails.push({ kind: 'due', p, ctx }); return { sent: true }; };
  notify.feeOverdueReminder = async (p, ctx) => { emails.push({ kind: 'overdue', p, ctx }); return { sent: true }; };
  sms.sendSms = async (to, text) => { texts.push({ to, text }); return { sent: true, id: 'm1' }; };
});

test('upcoming: a parent with a balance due in 3 days gets in-app and email, and the assignment is marked', async () => {
  wire({ fee: { _id: 'f1', name: 'First Term Fees', dueDate: at(3) } });
  const n = await svc.processUpcoming(3, Date.now() + 5000);
  assert.equal(n, 1);
  assert.equal(notes[0].type, 'due_reminder'); assert.equal(notes[0].title, 'Fee due in 3 days');
  assert.equal(emails[0].kind, 'due'); assert.equal(emails[0].ctx.daysLeft, 3);
  assert.equal(texts.length, 0, 'SMS is off unless the school opts in');
  assert.deepEqual(logs.map((l) => `${l.channel}:${l.status}`).sort(), ['email:sent', 'inapp:sent']);
  assert.equal(bulk[0].updateOne.update.$set['reminders.lastKind'], 'due_3d');
  assert.deepEqual(queries.asg.status, { $in: ['unpaid', 'partial'] });
});

test('upcoming: the same reminder is never sent twice on one day (job run twice)', async () => {
  wire({ fee: { _id: 'f1', name: 'Fees', dueDate: at(1) }, assignments: [asg({ reminders: { lastAt: new Date(), lastKind: 'due_1d' } })] });
  assert.equal(await svc.processUpcoming(1, Date.now() + 5000), 0);
  assert.equal(notes.length + emails.length, 0);
});

test('due today gets its own reminder', async () => {
  wire({ fee: { _id: 'f1', name: 'Fees', dueDate: at(0) } });
  await svc.processUpcoming(0, Date.now() + 5000);
  assert.equal(notes[0].title, 'Fee due today'); assert.equal(emails[0].ctx.daysLeft, 0);
});

test('overdue: first reminder the day after, counts up, and uses the overdue wording', async () => {
  wire({ fee: { _id: 'f1', name: 'First Term Fees', dueDate: at(-5) } });
  assert.equal(await svc.processOverdue(Date.now() + 5000), 1);
  assert.equal(notes[0].type, 'overdue_reminder'); assert.equal(notes[0].title, 'Fee overdue by 5 days');
  assert.equal(emails[0].kind, 'overdue'); assert.equal(emails[0].ctx.overdueDays, 5);
  const upd = bulk[0].updateOne.update;
  assert.equal(upd.$inc['reminders.overdueCount'], 1); assert.ok(upd.$set['reminders.lastOverdueAt']);
  // the query itself enforces the weekly gap and the cap
  assert.ok(queries.asg.$or && queries.asg['reminders.overdueCount']);
  assert.equal(queries.fee.dueDate.$lt.getTime(), at(0).getTime(), 'only fees past their due day');
});

test('overdue: a school can switch overdue reminders off', async () => {
  school.reminders.overdueEnabled = false;
  wire({ fee: { _id: 'f1', name: 'Fees', dueDate: at(-2) } });
  assert.equal(await svc.processOverdue(Date.now() + 5000), 0);
  assert.equal(notes.length, 0);
});

test('no linked parent: nothing is sent and nothing is marked', async () => {
  wire({ fee: { _id: 'f1', name: 'Fees', dueDate: at(-2) }, stu: { ...student, parentId: null } });
  assert.equal(await svc.processOverdue(Date.now() + 5000), 0);
  assert.equal(bulk.length, 0);
});

test('unverified parent email: in-app only, and the email skip is logged', async () => {
  wire({ fee: { _id: 'f1', name: 'Fees', dueDate: at(3) }, par: { ...parent, emailVerified: false } });
  await svc.processUpcoming(3, Date.now() + 5000);
  assert.equal(emails.length, 0); assert.equal(notes.length, 1);
  assert.ok(logs.some((l) => l.channel === 'email' && l.status === 'skipped'));
});

test('sms: only when the school opted in, and a parent without a phone is logged as skipped', async () => {
  school.reminders.smsEnabled = true;
  wire({ fee: { _id: 'f1', name: 'First Term Fees', dueDate: at(-3) } });
  await svc.processOverdue(Date.now() + 5000);
  assert.equal(texts.length, 1); assert.equal(texts[0].to, '08031234567');
  assert.ok(texts[0].text.includes('Bright Academy') && texts[0].text.includes('₦30,000') && texts[0].text.includes('overdue'));
  texts = []; logs = [];
  wire({ fee: { _id: 'f1', name: 'Fees', dueDate: at(-3) }, par: { ...parent, phone: undefined } });
  await svc.processOverdue(Date.now() + 5000);
  assert.equal(texts.length, 0); assert.ok(logs.some((l) => l.channel === 'sms' && l.reason === 'no_phone'));
});

test('sms: a locked school gets no SMS (it costs money), but in-app and email still go out', async () => {
  school.reminders.smsEnabled = true;
  school.createdAt = new Date(Date.now() - 400 * DAY);
  school.subscription = { pilotEndsAt: new Date(Date.now() - 200 * DAY) };
  wire({ fee: { _id: 'f1', name: 'Fees', dueDate: at(-3) } });
  await svc.processOverdue(Date.now() + 5000);
  assert.equal(texts.length, 0); assert.equal(notes.length, 1); assert.equal(emails.length, 1);
});

test('out of time: remaining reminders wait for the next run and are not marked', async () => {
  wire({ fee: { _id: 'f1', name: 'Fees', dueDate: at(-2) } });
  assert.equal(await svc.processOverdue(Date.now() - 1), 0);
  assert.equal(bulk.length, 0);
});

// ── Bursar: "Remind now" ─────────────────────────────────────────────────────
const manual = (a, extra = {}) => {
  FeeAssignment.findById = async () => a;
  FeeAssignment.updateOne = async (f, u) => { manual.updated = u; return {}; };
  Student.findById = () => chain(extra.stu === undefined ? student : extra.stu);
  FeeStructure.findById = () => chain({ name: 'First Term Fees', dueDate: at(-4) });
  School.findById = () => chain(school);
  User.findById = () => chain(extra.par === undefined ? parent : extra.par);
};
const user = { _id: 'b1', schoolId: 's1' };

test('manual: sends now, logs who sent it, and starts the 24-hour cooldown', async () => {
  manual({ ...asg(), reminders: {} });
  const r = await svc.sendManualReminder({ assignmentId: 'a1', user });
  assert.equal(r.ok, true); assert.ok(r.message.includes('in-app') && r.message.includes('email'));
  assert.ok(logs.every((l) => l.kind === 'manual' && String(l.sentBy) === 'b1'));
  assert.ok(manual.updated.$set['reminders.lastManualAt']);
  assert.equal(emails[0].kind, 'overdue');
});

test('manual: refuses a second reminder within a day, a settled fee, another school, and a student with no parent', async () => {
  manual({ ...asg(), reminders: { lastManualAt: new Date() } });
  assert.equal((await svc.sendManualReminder({ assignmentId: 'a1', user })).code, 'too_soon');
  manual(asg({ status: 'paid', balance: 0 }));
  assert.equal((await svc.sendManualReminder({ assignmentId: 'a1', user })).code, 'settled');
  manual(asg());
  assert.equal((await svc.sendManualReminder({ assignmentId: 'a1', user: { _id: 'x', schoolId: 'other' } })).code, 'not_found');
  manual(asg(), { stu: { ...student, parentId: null } });
  assert.equal((await svc.sendManualReminder({ assignmentId: 'a1', user })).code, 'no_parent');
  assert.equal(notes.length, 0);
});

// ── SMS helper ───────────────────────────────────────────────────────────────
test('sms numbers are normalised to Nigerian international format; bad numbers are rejected', () => {
  const f = sms.toNigerianMsisdn;
  assert.equal(f('0803 123 4567'), '2348031234567');
  assert.equal(f('+234 803 123 4567'), '2348031234567');
  assert.equal(f('+234 (0)803 123 4567'), '2348031234567');
  assert.equal(f('8031234567'), '2348031234567');
  assert.equal(f('12345'), null); assert.equal(f('0603 123 4567'), null); assert.equal(f(null), null);
});

// ── The real email templates (the tests above replace the senders) ───────────
test('email templates: overdue and due-today render, escape names, and show the hosted logo', () => {
  const tpl = require('../src/utils/emailTemplates');
  const school = { name: 'Bright <Academy>' };
  const base = { parentName: 'Mrs Okeke', school, studentName: 'Chidi', feeName: 'First Term Fees', balance: 30000, dueDate: new Date('2026-12-05'), url: 'https://app.edupay.test/login' };
  const o = tpl.feeOverdueReminder({ ...base, overdueDays: 5 });
  assert.equal(o.subject, 'Overdue school fee for Chidi');
  assert.ok(o.html.includes('Bright &lt;Academy&gt;') && !o.html.includes('<Academy>'));
  assert.ok(o.html.includes('₦30,000') && o.html.includes('5 days ago'));
  assert.ok(o.html.includes('https://app.edupay.test/logo-email.png'), 'the hosted logo is in the header');
  assert.equal(tpl.feeDueReminder({ ...base, daysLeft: 0 }).subject, 'Fee due today for Chidi');
  assert.equal(tpl.feeDueReminder({ ...base, daysLeft: 3 }).subject, 'Fee due in 3 days for Chidi');
});
