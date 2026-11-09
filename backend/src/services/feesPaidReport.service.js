// src/services/feesPaidReport.service.js
// "Fees paid so far" for a school, optionally limited to one term / session / class.
// Two lists: a ledger (one row per student fee: expected, paid, balance) and the payments behind it.
const FeeStructure  = require('../models/FeeStructure');
const FeeAssignment = require('../models/FeeAssignment');
const Student       = require('../models/Student');
const User          = require('../models/User');
const Payment       = require('../models/Payment');
const School        = require('../models/School');

const MAX_ASSIGNMENTS = 5000;
const MAX_PAYMENTS = 20000;
const iso = (d) => (d ? new Date(d).toISOString() : null);

const getFeesPaidReport = async (schoolId, { term, academicSession, cls } = {}) => {
  const feeFilter = { schoolId };
  if (term)            feeFilter.term = term;
  if (academicSession) feeFilter.academicSession = academicSession;
  if (cls)             feeFilter.class = cls;

  const [school, fees] = await Promise.all([
    School.findById(schoolId).select('name').lean(),
    FeeStructure.find(feeFilter).select('name term academicSession dueDate class').lean(),
  ]);
  const base = { school: { name: school?.name || '' }, filters: { term: term || '', academicSession: academicSession || '', class: cls || '' }, generatedAt: new Date().toISOString() };
  const empty = { ...base, truncated: false, totals: { students: 0, expected: 0, paid: 0, outstanding: 0, overpaid: 0, rate: 0, paidInFull: 0, partial: 0, unpaid: 0, overpaidCount: 0, payments: 0 }, ledger: [], payments: [] };
  if (!fees.length) return empty;

  const feeById = new Map(fees.map((f) => [String(f._id), f]));
  const assignments = await FeeAssignment.find({ schoolId, feeStructureId: { $in: fees.map((f) => f._id) } })
    .select('studentId feeStructureId amountExpected totalPaid balance overpayment status lastPaymentAt').limit(MAX_ASSIGNMENTS + 1).lean();
  const truncated = assignments.length > MAX_ASSIGNMENTS;
  if (truncated) assignments.pop();
  if (!assignments.length) return empty;

  const students = await Student.find({ _id: { $in: assignments.map((a) => a.studentId) } }).select('fullName studentId class parentId').lean();
  const studentOf = new Map(students.map((s) => [String(s._id), s]));
  const parentIds = [...new Set(students.map((s) => String(s.parentId || '')).filter(Boolean))];
  const parents = parentIds.length ? await User.find({ _id: { $in: parentIds } }).select('fullName phone email').lean() : [];
  const parentOf = new Map(parents.map((p) => [String(p._id), p]));
  const payments = await Payment.find({ schoolId, feeAssignmentId: { $in: assignments.map((a) => a._id) } })
    .select('feeAssignmentId studentId amountPaid netAmountForSchool platformFee platformFeeWaived gateway source reference payerAccountName payerBankName reconciliationStatus processedAt')
    .sort({ processedAt: 1 }).limit(MAX_PAYMENTS).lean();

  const countOf = new Map();
  payments.forEach((p) => countOf.set(String(p.feeAssignmentId), (countOf.get(String(p.feeAssignmentId)) || 0) + 1));
  const assignmentOf = new Map(assignments.map((a) => [String(a._id), a]));

  const ledger = assignments.map((a) => {
    const s = studentOf.get(String(a.studentId)) || {}; const f = feeById.get(String(a.feeStructureId)) || {};
    const par = parentOf.get(String(s.parentId)) || {};
    return { studentCode: s.studentId || '', studentName: s.fullName || '', class: s.class || '',
      parentName: par.fullName || '', parentPhone: par.phone || '', parentEmail: par.email || '',
      fee: f.name || '', term: f.term || '', session: f.academicSession || '', dueDate: iso(f.dueDate),
      expected: a.amountExpected || 0, paid: a.totalPaid || 0, balance: a.balance || 0, overpayment: a.overpayment || 0,
      status: a.status, lastPaymentAt: iso(a.lastPaymentAt), paymentCount: countOf.get(String(a._id)) || 0 };
  }).sort((x, y) => x.class.localeCompare(y.class, undefined, { numeric: true }) || x.studentName.localeCompare(y.studentName) || x.fee.localeCompare(y.fee));

  const paymentRows = payments.map((p) => {
    const a = assignmentOf.get(String(p.feeAssignmentId)); const s = studentOf.get(String(p.studentId)) || {};
    const f = (a && feeById.get(String(a.feeStructureId))) || {};
    return { date: iso(p.processedAt), studentCode: s.studentId || '', studentName: s.fullName || '', class: s.class || '', fee: f.name || '',
      amountPaid: p.amountPaid || 0, appliedToFee: p.netAmountForSchool ?? p.amountPaid ?? 0,
      serviceCharge: p.platformFeeWaived ? 0 : (p.platformFee || 0),
      channel: p.gateway, method: p.gateway === 'manual' ? 'Recorded by school' : 'Bank transfer',
      reference: p.reference || '', payer: p.payerAccountName || '', bank: p.payerBankName || '', result: p.reconciliationStatus };
  });

  const sum = (k) => ledger.reduce((n, r) => n + (r[k] || 0), 0);
  const expected = sum('expected'); const paid = sum('paid');
  const totals = { students: new Set(assignments.map((a) => String(a.studentId))).size, expected, paid, outstanding: sum('balance'), overpaid: sum('overpayment'),
    rate: expected > 0 ? Math.round((paid / expected) * 100) : 0,
    paidInFull: ledger.filter((r) => r.status === 'paid').length, partial: ledger.filter((r) => r.status === 'partial').length,
    unpaid: ledger.filter((r) => r.status === 'unpaid').length, overpaidCount: ledger.filter((r) => r.status === 'overpaid').length,
    payments: paymentRows.length };
  return { ...base, truncated, totals, ledger, payments: paymentRows };
};

module.exports = { getFeesPaidReport };
