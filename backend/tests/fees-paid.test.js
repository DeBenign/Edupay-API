// "Fees paid so far" report: ledger + payments + totals for one term, scoped to one school.
process.env.JWT_SECRET = 'test-secret'; process.env.MONGO_URI = 'mongodb://unused'; process.env.VERCEL = '1';
const test = require('node:test');
const assert = require('node:assert/strict');
const FeeStructure = require('../src/models/FeeStructure');
const FeeAssignment = require('../src/models/FeeAssignment');
const Student = require('../src/models/Student');
const User = require('../src/models/User');
const Payment = require('../src/models/Payment');
const School = require('../src/models/School');
const { getFeesPaidReport } = require('../src/services/feesPaidReport.service');

const chain = (v) => { const c = { select: () => c, sort: () => c, limit: () => c, lean: async () => v, then: (a, b) => Promise.resolve(v).then(a, b) }; return c; };

test('report: totals, per-student ledger, payment rows, and the term filter reaches the query', async () => {
  let feeQuery;
  School.findById = () => chain({ name: 'Bright Academy' });
  FeeStructure.find = (q) => { feeQuery = q; return chain([{ _id: 'f1', name: 'First Term Fees', term: 'first', academicSession: '2026/2027', dueDate: new Date('2026-12-05'), class: 'JSS 1' }]); };
  FeeAssignment.find = () => chain([
    { _id: 'a1', studentId: 's1', feeStructureId: 'f1', amountExpected: 50000, totalPaid: 50000, balance: 0, overpayment: 0, status: 'paid', lastPaymentAt: new Date('2026-10-20') },
    { _id: 'a2', studentId: 's2', feeStructureId: 'f1', amountExpected: 50000, totalPaid: 20000, balance: 30000, overpayment: 0, status: 'partial', lastPaymentAt: new Date('2026-10-22') },
    { _id: 'a3', studentId: 's3', feeStructureId: 'f1', amountExpected: 50000, totalPaid: 0, balance: 50000, overpayment: 0, status: 'unpaid', lastPaymentAt: null },
  ]);
  Student.find = () => chain([
    { _id: 's1', fullName: 'Chidi Okeke', studentId: 'DB/26/001', class: 'JSS 1', parentId: 'p1' },
    { _id: 's2', fullName: 'Ada Bello', studentId: 'DB/26/002', class: 'JSS 1', parentId: null },
    { _id: 's3', fullName: 'Aisha Musa', studentId: 'DB/26/003', class: 'JSS 1', parentId: null },
  ]);
  User.find = () => chain([{ _id: 'p1', fullName: 'Mrs Okeke', phone: '08031234567', email: 'mum@x.test' }]);
  Payment.find = () => chain([
    { feeAssignmentId: 'a1', studentId: 's1', amountPaid: 50863, netAmountForSchool: 50000, platformFee: 863, gateway: 'nomba', source: 'webhook', reference: 'R1', payerAccountName: 'Mr Okeke', payerBankName: 'GTBank', reconciliationStatus: 'exact', processedAt: new Date('2026-10-20') },
    { feeAssignmentId: 'a2', studentId: 's2', amountPaid: 20000, netAmountForSchool: 20000, platformFee: 0, gateway: 'manual', source: 'manual', reference: 'R2', reconciliationStatus: 'underpayment', processedAt: new Date('2026-10-22') },
  ]);

  const r = await getFeesPaidReport('school1', { term: 'first', academicSession: '2026/2027' });
  assert.equal(feeQuery.schoolId, 'school1'); assert.equal(feeQuery.term, 'first'); assert.equal(feeQuery.academicSession, '2026/2027');
  assert.deepEqual([r.totals.expected, r.totals.paid, r.totals.outstanding, r.totals.rate], [150000, 70000, 80000, 47]);
  assert.deepEqual([r.totals.paidInFull, r.totals.partial, r.totals.unpaid, r.totals.students, r.totals.payments], [1, 1, 1, 3, 2]);
  assert.equal(r.ledger[0].studentName, 'Ada Bello', 'sorted by class then name');
  const chidi = r.ledger.find((x) => x.studentCode === 'DB/26/001');
  assert.deepEqual([chidi.parentName, chidi.parentPhone, chidi.paymentCount, chidi.status], ['Mrs Okeke', '08031234567', 1, 'paid']);
  assert.deepEqual([r.payments[0].amountPaid, r.payments[0].appliedToFee, r.payments[0].serviceCharge, r.payments[0].method], [50863, 50000, 863, 'Bank transfer']);
  assert.equal(r.payments[1].method, 'Recorded by school');
  assert.equal(r.school.name, 'Bright Academy');
});

test('report: no matching fees gives an empty, well-formed report', async () => {
  School.findById = () => chain({ name: 'Bright Academy' });
  FeeStructure.find = () => chain([]);
  const r = await getFeesPaidReport('school1', { term: 'third' });
  assert.equal(r.ledger.length, 0); assert.equal(r.totals.expected, 0); assert.equal(r.filters.term, 'third');
});
