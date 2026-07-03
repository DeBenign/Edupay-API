// src/services/report.service.js
// ─────────────────────────────────────────────────────────────────────────────
// All reporting queries live here. Controllers call these; they never query
// the DB directly. Keeps controllers thin and reports easily testable.
// ─────────────────────────────────────────────────────────────────────────────

const FeeAssignment = require('../models/FeeAssignment');
const Payment       = require('../models/Payment');
const Student       = require('../models/Student');
const FeeStructure  = require('../models/FeeStructure');

// ─── 1. School-wide collection summary ───────────────────────────────────────
/**
 * High-level numbers for the bursar/admin dashboard header cards.
 * Optionally filtered by term and/or academic session.
 *
 * Returns: totalExpected, totalCollected, totalOutstanding, totalOverpaid,
 *          fullyPaid, partialCount, unpaidCount, overpaidCount, totalStudents
 */
const getSchoolSummary = async (schoolId, { term, academicSession } = {}) => {
  // Build fee structure filter for scoping by term/session
  const feeFilter = { schoolId, isActive: true };
  if (term)            feeFilter.term            = term;
  if (academicSession) feeFilter.academicSession = academicSession;

  let feeStructureIds = null;
  if (term || academicSession) {
    const structures = await FeeStructure.find(feeFilter).select('_id');
    feeStructureIds  = structures.map(s => s._id);
  }

  // Build assignment filter
  const assignmentFilter = { schoolId };
  if (feeStructureIds) assignmentFilter.feeStructureId = { $in: feeStructureIds };

  const assignments = await FeeAssignment.find(assignmentFilter).lean();

  const summary = {
    totalStudents:   await Student.countDocuments({ schoolId, isActive: true }),
    totalExpected:   0,
    totalCollected:  0,
    totalOutstanding:0,
    totalOverpaid:   0,
    fullyPaid:       0,
    partialCount:    0,
    unpaidCount:     0,
    overpaidCount:   0,
  };

  for (const a of assignments) {
    summary.totalExpected    += a.amountExpected;
    summary.totalCollected   += a.totalPaid;
    summary.totalOutstanding += a.balance;
    summary.totalOverpaid    += a.overpayment;

    if (a.status === 'paid')     summary.fullyPaid++;
    if (a.status === 'partial')  summary.partialCount++;
    if (a.status === 'unpaid')   summary.unpaidCount++;
    if (a.status === 'overpaid') summary.overpaidCount++;
  }

  // Collection rate as a percentage
  summary.collectionRate = summary.totalExpected > 0
    ? Math.round((summary.totalCollected / summary.totalExpected) * 100)
    : 0;

  return summary;
};

// ─── 2. Class-by-class breakdown ─────────────────────────────────────────────
/**
 * Groups fee assignments by student class and returns per-class totals.
 * Used by the Reports page table.
 */
const getClassBreakdown = async (schoolId, { term, academicSession } = {}) => {
  // Get all active students grouped by class
  const students = await Student.find({ schoolId, isActive: true })
    .select('_id class')
    .lean();

  const studentsByClass = {};
  for (const s of students) {
    if (!studentsByClass[s.class]) studentsByClass[s.class] = [];
    studentsByClass[s.class].push(s._id);
  }

  // Fee structure scope
  const feeFilter = { schoolId, isActive: true };
  if (term)            feeFilter.term            = term;
  if (academicSession) feeFilter.academicSession = academicSession;

  let feeStructureIds = null;
  if (term || academicSession) {
    const structures    = await FeeStructure.find(feeFilter).select('_id');
    feeStructureIds     = structures.map(s => s._id);
  }

  const classes = [];

  for (const [className, studentIds] of Object.entries(studentsByClass)) {
    const filter = { studentId: { $in: studentIds }, schoolId };
    if (feeStructureIds) filter.feeStructureId = { $in: feeStructureIds };

    const assignments = await FeeAssignment.find(filter).lean();
    if (assignments.length === 0) continue;

    const row = {
      class:            className,
      totalStudents:    studentIds.length,
      totalExpected:    0,
      totalCollected:   0,
      totalOutstanding: 0,
      fullyPaid:        0,
      partialCount:     0,
      unpaidCount:      0,
      overpaidCount:    0,
    };

    for (const a of assignments) {
      row.totalExpected    += a.amountExpected;
      row.totalCollected   += a.totalPaid;
      row.totalOutstanding += a.balance;
      if (a.status === 'paid')     row.fullyPaid++;
      if (a.status === 'partial')  row.partialCount++;
      if (a.status === 'unpaid')   row.unpaidCount++;
      if (a.status === 'overpaid') row.overpaidCount++;
    }

    row.rate = row.totalExpected > 0
      ? Math.round((row.totalCollected / row.totalExpected) * 100)
      : 0;

    classes.push(row);
  }

  // Sort by class name
  classes.sort((a, b) => a.class.localeCompare(b.class));

  return classes;
};

// ─── 3. Overpayments report ───────────────────────────────────────────────────
/**
 * Returns all fee assignments where overpayment > 0.
 * Used by the bursar to action refunds or credits.
 */
const getOverpaymentsReport = async (schoolId, { page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;

  const [assignments, totalCount] = await Promise.all([
    FeeAssignment.find({ schoolId, status: 'overpaid' })
      .populate('studentId',     'fullName studentId class virtualAccount')
      .populate('feeStructureId','name term academicSession')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FeeAssignment.countDocuments({ schoolId, status: 'overpaid' }),
  ]);

  const totalOverpaid = assignments.reduce((sum, a) => sum + a.overpayment, 0);

  return {
    assignments,
    totalCount,
    totalOverpaid,
    pagination: {
      page, limit, totalCount,
      totalPages:  Math.ceil(totalCount / limit),
      hasNextPage: page < Math.ceil(totalCount / limit),
    },
  };
};

// ─── 4. Per-student statement ─────────────────────────────────────────────────
/**
 * Full statement for one student — all terms, all payments.
 * Used for generating downloadable student statements.
 */
const getStudentStatement = async (studentId, schoolId) => {
  const student = await Student.findOne({ _id: studentId, schoolId })
    .populate('parentId', 'fullName email phone')
    .lean();

  if (!student) throw new Error('Student not found');

  const [assignments, payments] = await Promise.all([
    FeeAssignment.find({ studentId })
      .populate('feeStructureId', 'name term academicSession amount dueDate')
      .sort({ createdAt: -1 })
      .lean(),
    Payment.find({ studentId })
      .sort({ processedAt: 1 })
      .lean(),
  ]);

  // Map payments to their assignment
  const paymentsByAssignment = {};
  for (const p of payments) {
    const key = p.feeAssignmentId.toString();
    if (!paymentsByAssignment[key]) paymentsByAssignment[key] = [];
    paymentsByAssignment[key].push(p);
  }

  const terms = assignments.map(a => ({
    ...a,
    payments: paymentsByAssignment[a._id.toString()] || [],
  }));

  const totals = {
    totalExpected:  assignments.reduce((s, a) => s + a.amountExpected, 0),
    totalPaid:      assignments.reduce((s, a) => s + a.totalPaid, 0),
    totalBalance:   assignments.reduce((s, a) => s + a.balance, 0),
    totalOverpaid:  assignments.reduce((s, a) => s + a.overpayment, 0),
    paymentCount:   payments.length,
  };

  return { student, terms, totals, generatedAt: new Date() };
};

// ─── 5. Recent transactions feed (bursar dashboard) ──────────────────────────
/**
 * Last N payments across the school — for the initial feed state before
 * Socket.io takes over with live events.
 */
const getRecentPayments = async (schoolId, limit = 20) => {
  const payments = await Payment.find({ schoolId })
    .populate('studentId', 'fullName studentId class')
    .populate({
      path:     'feeAssignmentId',
      populate: { path: 'feeStructureId', select: 'name term academicSession' },
    })
    .sort({ processedAt: -1 })
    .limit(limit)
    .lean();

  return payments;
};

module.exports = {
  getSchoolSummary,
  getClassBreakdown,
  getOverpaymentsReport,
  getStudentStatement,
  getRecentPayments,
};
