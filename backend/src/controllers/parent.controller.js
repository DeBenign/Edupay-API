// src/controllers/parent.controller.js
// Everything a parent needs — scoped strictly to their own children.
// No parent can ever see another parent's child data.

const Student = require('../models/Student');
const FeeAssignment = require('../models/FeeAssignment');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { paginate } = require('../utils/paginate');
const {
  success, badRequest, notFound, error, forbidden, paginated,
} = require('../utils/apiResponse');

// ─── Helper: verify parent owns the student ───────────────────────────────────
const assertParentOwnsStudent = async (parentId, studentId) => {
  const student = await Student.findOne({
    _id: studentId,
    parentId,
    isActive: true,
  });
  return student;
};

// ─── GET /api/parents/dashboard ───────────────────────────────────────────────
// Single-screen overview: all children + their current payment status.
const getDashboard = async (req, res) => {
  try {
    const parentId = req.user._id;

    const children = await Student.find({ parentId, isActive: true })
      .select('fullName studentId class gender virtualAccount')
      .lean();

    if (children.length === 0) {
      return success(res, {
        summary: { totalChildren: 0, totalOwed: 0, totalPaid: 0, fullyPaid: 0 },
        children: [],
      }, 'No children linked to your account yet. Contact the school to link your child.');
    }

    const studentIds = children.map((c) => c._id);

    const assignments = await FeeAssignment.find({ studentId: { $in: studentIds } })
      .populate('feeStructureId', 'name term academicSession amount dueDate')
      .sort({ createdAt: -1 })
      .lean();

    // Group assignments by studentId
    const assignmentMap = {};
    assignments.forEach((a) => {
      const key = a.studentId.toString();
      if (!assignmentMap[key]) assignmentMap[key] = [];
      assignmentMap[key].push(a);
    });

    let totalOwed = 0;
    let totalPaid = 0;
    let fullyPaid = 0;

    const enrichedChildren = children.map((child) => {
      const childAssignments = assignmentMap[child._id.toString()] || [];
      const latestAssignment = childAssignments[0] || null;

      const childOwed = childAssignments.reduce((sum, a) => sum + (a.balance || 0), 0);
      const childPaid = childAssignments.reduce((sum, a) => sum + (a.totalPaid || 0), 0);
      const isPaidUp  = childAssignments.length > 0 &&
                        childAssignments.every((a) => a.status === 'paid');

      totalOwed += childOwed;
      totalPaid += childPaid;
      if (isPaidUp) fullyPaid += 1;

      return {
        _id:           child._id,
        fullName:      child.fullName,
        studentId:     child.studentId,
        class:         child.class,
        gender:        child.gender,
        hasAccount:    !!child.virtualAccount?.accountNumber,
        accountNumber: child.virtualAccount?.accountNumber || null,
        bankName:      child.virtualAccount?.bankName || null,
        currentTerm: latestAssignment ? {
          name:            latestAssignment.feeStructureId?.name,
          term:            latestAssignment.feeStructureId?.term,
          academicSession: latestAssignment.feeStructureId?.academicSession,
          amountExpected:  latestAssignment.amountExpected,
          totalPaid:       latestAssignment.totalPaid,
          balance:         latestAssignment.balance,
          overpayment:     latestAssignment.overpayment,
          status:          latestAssignment.status,
          dueDate:         latestAssignment.feeStructureId?.dueDate,
        } : null,
        totalTerms: childAssignments.length,
        isPaidUp,
      };
    });

    return success(res, {
      summary: {
        totalChildren:  children.length,
        totalOwed:      Math.max(totalOwed, 0),
        totalPaid,
        fullyPaid,
        hasOutstanding: totalOwed > 0,
      },
      children: enrichedChildren,
    });
  } catch (err) {
    console.error('getDashboard error:', err.message);
    return error(res);
  }
};

// ─── GET /api/parents/children ────────────────────────────────────────────────
// Lightweight list of all linked children — used for navigation/sidebar
const getChildren = async (req, res) => {
  try {
    const children = await Student.find({ parentId: req.user._id, isActive: true })
      .select('fullName studentId class gender virtualAccount createdAt')
      .sort({ fullName: 1 });

    return success(res, { children, count: children.length });
  } catch (err) {
    console.error('getChildren error:', err.message);
    return error(res);
  }
};

// ─── GET /api/parents/children/:studentId/account ─────────────────────────────
// Account number + bank details for making payment.
// This is what parents screenshot and save in their banking app.
const getChildAccount = async (req, res) => {
  try {
    const student = await assertParentOwnsStudent(req.user._id, req.params.studentId);
    if (!student) return notFound(res, 'Child not found or not linked to your account');

    if (!student.virtualAccount?.accountNumber) {
      return notFound(res, 'Payment account not yet set up. Please contact the school.');
    }

    // Fetch outstanding balances to show alongside account details
    const openAssignments = await FeeAssignment.find({
      studentId: student._id,
      status: { $in: ['unpaid', 'partial'] },
    })
      .populate('feeStructureId', 'name term academicSession dueDate amount')
      .sort({ createdAt: -1 });

    const totalOutstanding = openAssignments.reduce((sum, a) => sum + a.balance, 0);

    return success(res, {
      paymentDetails: {
        accountNumber: student.virtualAccount.accountNumber,
        accountName:   student.virtualAccount.accountName,
        bankName:      student.virtualAccount.bankName,
        instruction:   'Transfer any amount to this account. Payment will be automatically confirmed.',
      },
      student: {
        fullName:  student.fullName,
        studentId: student.studentId,
        class:     student.class,
      },
      outstandingFees: openAssignments.map((a) => ({
        name:            a.feeStructureId?.name,
        term:            a.feeStructureId?.term,
        academicSession: a.feeStructureId?.academicSession,
        amountExpected:  a.amountExpected,
        totalPaid:       a.totalPaid,
        balance:         a.balance,
        dueDate:         a.feeStructureId?.dueDate,
        status:          a.status,
      })),
      totalOutstanding,
    });
  } catch (err) {
    console.error('getChildAccount error:', err.message);
    return error(res);
  }
};

// ─── GET /api/parents/children/:studentId/balance ─────────────────────────────
// Per-term breakdown of what's owed, paid, and outstanding
const getChildBalance = async (req, res) => {
  try {
    const student = await assertParentOwnsStudent(req.user._id, req.params.studentId);
    if (!student) return notFound(res, 'Child not found or not linked to your account');

    const assignments = await FeeAssignment.find({ studentId: student._id })
      .populate('feeStructureId', 'name term academicSession amount dueDate')
      .sort({ createdAt: -1 });

    const summary = {
      totalExpected:  assignments.reduce((s, a) => s + a.amountExpected, 0),
      totalPaid:      assignments.reduce((s, a) => s + a.totalPaid, 0),
      totalBalance:   assignments.reduce((s, a) => s + a.balance, 0),
      totalOverpaid:  assignments.reduce((s, a) => s + a.overpayment, 0),
      fullyPaidTerms: assignments.filter((a) => a.status === 'paid').length,
      pendingTerms:   assignments.filter((a) => ['unpaid', 'partial'].includes(a.status)).length,
    };

    const terms = assignments.map((a) => ({
      _id:             a._id,
      name:            a.feeStructureId?.name,
      term:            a.feeStructureId?.term,
      academicSession: a.feeStructureId?.academicSession,
      amountExpected:  a.amountExpected,
      totalPaid:       a.totalPaid,
      balance:         a.balance,
      overpayment:     a.overpayment,
      status:          a.status,
      dueDate:         a.feeStructureId?.dueDate,
      lastPaymentAt:   a.lastPaymentAt,
    }));

    return success(res, {
      student: {
        fullName:  student.fullName,
        studentId: student.studentId,
        class:     student.class,
      },
      summary,
      terms,
    });
  } catch (err) {
    console.error('getChildBalance error:', err.message);
    return error(res);
  }
};

// ─── GET /api/parents/children/:studentId/payments ────────────────────────────
// Full paginated payment history — every transfer ever made for this child
const getChildPaymentHistory = async (req, res) => {
  try {
    const student = await assertParentOwnsStudent(req.user._id, req.params.studentId);
    if (!student) return notFound(res, 'Child not found or not linked to your account');

    const { skip, limit, buildPagination } = paginate(req.query);

    const filter = { studentId: student._id };
    if (req.query.feeAssignmentId) filter.feeAssignmentId = req.query.feeAssignmentId;

    const [payments, totalCount] = await Promise.all([
      Payment.find(filter)
        .populate({
          path: 'feeAssignmentId',
          populate: { path: 'feeStructureId', select: 'name term academicSession' },
        })
        .sort({ processedAt: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments(filter),
    ]);

    const formattedPayments = payments.map((p) => ({
      _id:                  p._id,
      amountPaid:           p.amountPaid,
      currency:             p.currency,
      reference:            p.reference,
      narration:            p.narration,
      payerAccountName:     p.payerAccountName,
      payerBankName:        p.payerBankName,
      reconciliationStatus: p.reconciliationStatus,
      balanceBefore:        p.balanceBefore,
      balanceAfter:         p.balanceAfter,
      overpaymentAmount:    p.overpaymentAmount,
      term:                 p.feeAssignmentId?.feeStructureId?.term || null,
      termName:             p.feeAssignmentId?.feeStructureId?.name || null,
      academicSession:      p.feeAssignmentId?.feeStructureId?.academicSession || null,
      processedAt:          p.processedAt,
    }));

    return paginated(
      res,
      {
        student:  { fullName: student.fullName, studentId: student.studentId },
        payments: formattedPayments,
      },
      buildPagination(totalCount)
    );
  } catch (err) {
    console.error('getChildPaymentHistory error:', err.message);
    return error(res);
  }
};

// ─── POST /api/parents/link-child ─────────────────────────────────────────────
// Parent self-service: link themselves to a child using school-issued student ID.
// School must have enrolled the student first.
const linkChild = async (req, res) => {
  try {
    const { studentId, schoolId } = req.body;

    if (!studentId || !schoolId) {
      return badRequest(res, 'studentId (school-issued) and schoolId are required');
    }

    const student = await Student.findOne({ studentId, schoolId, isActive: true });

    if (!student) {
      return notFound(
        res,
        'Student not found. Check the student ID and school, or contact the school admin.'
      );
    }

    // Prevent claiming another parent's child
    if (student.parentId && student.parentId.toString() !== req.user._id.toString()) {
      return forbidden(
        res,
        'This student is already linked to another parent account. Contact the school to resolve this.'
      );
    }

    // Already linked — idempotent response
    if (student.parentId?.toString() === req.user._id.toString()) {
      return success(res, { student }, `${student.fullName} is already linked to your account`);
    }

    student.parentId = req.user._id;
    await student.save();

    // Attach school to parent if not already set
    if (!req.user.schoolId) {
      await User.findByIdAndUpdate(req.user._id, { schoolId: student.schoolId });
    }

    return success(res, {
      student: {
        fullName:      student.fullName,
        studentId:     student.studentId,
        class:         student.class,
        accountNumber: student.virtualAccount?.accountNumber || null,
        bankName:      student.virtualAccount?.bankName || null,
      },
    }, `${student.fullName} successfully linked to your account`);
  } catch (err) {
    console.error('linkChild error:', err.message);
    return error(res);
  }
};

// ─── DELETE /api/parents/children/:studentId/unlink ──────────────────────────
// Parent unlinks a child (e.g. wrong student was linked by mistake)
const unlinkChild = async (req, res) => {
  try {
    const student = await assertParentOwnsStudent(req.user._id, req.params.studentId);
    if (!student) return notFound(res, 'Child not found or not linked to your account');

    student.parentId = null;
    await student.save();

    return success(res, null, `${student.fullName} has been unlinked from your account`);
  } catch (err) {
    console.error('unlinkChild error:', err.message);
    return error(res);
  }
};

// ─── GET /api/parents/notifications ──────────────────────────────────────────
// Parent's payment confirmations and due-date alerts
// Marks notifications as read automatically on fetch
const getNotifications = async (req, res) => {
  try {
    const { Notification } = require('../models/WebhookLog');
    const { skip, limit, buildPagination } = paginate(req.query);

    const filter = { userId: req.user._id };
    if (req.query.unread === 'true') filter.read = false;

    const [notifications, totalCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
    ]);

    // Auto-mark as read on fetch
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n._id);
    if (unreadIds.length > 0) {
      await Notification.updateMany({ _id: { $in: unreadIds } }, { read: true });
    }

    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      read: false,
    });

    return paginated(
      res,
      { notifications, unreadCount },
      buildPagination(totalCount)
    );
  } catch (err) {
    console.error('getNotifications error:', err.message);
    return error(res);
  }
};

module.exports = {
  getDashboard,
  getChildren,
  getChildAccount,
  getChildBalance,
  getChildPaymentHistory,
  linkChild,
  unlinkChild,
  getNotifications,
};
