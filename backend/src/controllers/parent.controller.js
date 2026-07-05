// src/controllers/parent.controller.js
const Student       = require('../models/Student');
const FeeAssignment = require('../models/FeeAssignment');
const Payment       = require('../models/Payment');
const User          = require('../models/User');
const { paginate }  = require('../utils/paginate');
const { success, badRequest, notFound, error, forbidden, paginated } = require('../utils/apiResponse');

const assertOwns = async (parentId, studentId) =>
  Student.findOne({ _id: studentId, parentId, isActive: true });

const getDashboard = async (req, res) => {
  try {
    const children = await Student.find({ parentId: req.user._id, isActive: true }).select('fullName studentId class gender virtualAccount').lean();
    if (!children.length) return success(res, { summary: { totalChildren:0, totalOwed:0, totalPaid:0, fullyPaid:0 }, children: [] }, 'No children linked yet.');
    const studentIds  = children.map(c => c._id);
    const assignments = await FeeAssignment.find({ studentId: { $in: studentIds } }).populate('feeStructureId','name term academicSession amount dueDate').sort({ createdAt: -1 }).lean();
    const aMap = {};
    assignments.forEach(a => { const k = a.studentId.toString(); if (!aMap[k]) aMap[k] = []; aMap[k].push(a); });
    let totalOwed=0, totalPaid=0, fullyPaid=0;
    const enriched = children.map(child => {
      const ca = aMap[child._id.toString()] || [];
      const la = ca[0] || null;
      const owed = ca.reduce((s,a) => s+(a.balance||0), 0);
      const paid = ca.reduce((s,a) => s+(a.totalPaid||0), 0);
      const paidUp = ca.length > 0 && ca.every(a => a.status === 'paid');
      totalOwed += owed; totalPaid += paid; if (paidUp) fullyPaid++;
      return { ...child, hasAccount: !!child.virtualAccount?.accountNumber, accountNumber: child.virtualAccount?.accountNumber||null, bankName: child.virtualAccount?.bankName||null, currentTerm: la ? { name: la.feeStructureId?.name, term: la.feeStructureId?.term, academicSession: la.feeStructureId?.academicSession, amountExpected: la.amountExpected, totalPaid: la.totalPaid, balance: la.balance, overpayment: la.overpayment, status: la.status, dueDate: la.feeStructureId?.dueDate } : null, isPaidUp: paidUp };
    });
    return success(res, { summary: { totalChildren: children.length, totalOwed: Math.max(totalOwed,0), totalPaid, fullyPaid, hasOutstanding: totalOwed>0 }, children: enriched });
  } catch (err) { return error(res); }
};

const getChildren = async (req, res) => {
  try {
    const children = await Student.find({ parentId: req.user._id, isActive: true }).select('fullName studentId class gender virtualAccount createdAt').sort({ fullName: 1 });
    return success(res, { children, count: children.length });
  } catch (err) { return error(res); }
};

const getChildAccount = async (req, res) => {
  try {
    const student = await assertOwns(req.user._id, req.params.studentId);
    if (!student) return notFound(res, 'Child not found or not linked to your account');
    if (!student.virtualAccount?.accountNumber) return notFound(res, 'Payment account not yet set up. Contact the school.');
    const openAssignments = await FeeAssignment.find({ studentId: student._id, status: { $in: ['unpaid','partial'] } }).populate('feeStructureId','name term academicSession dueDate amount').sort({ createdAt: -1 });
    const totalOutstanding = openAssignments.reduce((s,a) => s+a.balance, 0);
    return success(res, { paymentDetails: { accountNumber: student.virtualAccount.accountNumber, accountName: student.virtualAccount.accountName, bankName: student.virtualAccount.bankName, instruction: 'Transfer to this account. Payment reconciles automatically.' }, student: { fullName: student.fullName, studentId: student.studentId, class: student.class }, outstandingFees: openAssignments.map(a => ({ name: a.feeStructureId?.name, term: a.feeStructureId?.term, academicSession: a.feeStructureId?.academicSession, amountExpected: a.amountExpected, totalPaid: a.totalPaid, balance: a.balance, dueDate: a.feeStructureId?.dueDate, status: a.status })), totalOutstanding });
  } catch (err) { return error(res); }
};

const getChildBalance = async (req, res) => {
  try {
    const student = await assertOwns(req.user._id, req.params.studentId);
    if (!student) return notFound(res, 'Child not found or not linked to your account');
    const assignments = await FeeAssignment.find({ studentId: student._id }).populate('feeStructureId','name term academicSession amount dueDate').sort({ createdAt: -1 });
    const summary = { totalExpected: assignments.reduce((s,a)=>s+a.amountExpected,0), totalPaid: assignments.reduce((s,a)=>s+a.totalPaid,0), totalBalance: assignments.reduce((s,a)=>s+a.balance,0), totalOverpaid: assignments.reduce((s,a)=>s+a.overpayment,0), fullyPaidTerms: assignments.filter(a=>a.status==='paid').length, pendingTerms: assignments.filter(a=>['unpaid','partial'].includes(a.status)).length };
    return success(res, { student: { fullName: student.fullName, studentId: student.studentId, class: student.class }, summary, terms: assignments.map(a=>({ _id:a._id, name:a.feeStructureId?.name, term:a.feeStructureId?.term, academicSession:a.feeStructureId?.academicSession, amountExpected:a.amountExpected, totalPaid:a.totalPaid, balance:a.balance, overpayment:a.overpayment, status:a.status, dueDate:a.feeStructureId?.dueDate, lastPaymentAt:a.lastPaymentAt })) });
  } catch (err) { return error(res); }
};

const getChildPaymentHistory = async (req, res) => {
  try {
    const student = await assertOwns(req.user._id, req.params.studentId);
    if (!student) return notFound(res, 'Child not found or not linked to your account');
    const { skip, limit, buildPagination } = paginate(req.query);
    const [payments, total] = await Promise.all([
      Payment.find({ studentId: student._id }).sort({ processedAt: -1 }).skip(skip).limit(limit),
      Payment.countDocuments({ studentId: student._id }),
    ]);
    return paginated(res, { student: { fullName: student.fullName, studentId: student.studentId }, payments }, buildPagination(total));
  } catch (err) { return error(res); }
};

const linkChild = async (req, res) => {
  try {
    const { studentId, schoolId } = req.body;
    if (!studentId || !schoolId) return badRequest(res, 'studentId and schoolId are required');
    const student = await Student.findOne({ studentId, schoolId, isActive: true });
    if (!student) return notFound(res, 'Student not found. Check the student ID and school.');
    if (student.parentId && student.parentId.toString() !== req.user._id.toString()) return forbidden(res, 'This student is already linked to another parent. Contact the school.');
    if (student.parentId?.toString() === req.user._id.toString()) return success(res, { student }, `${student.fullName} is already linked to your account`);
    student.parentId = req.user._id;
    await student.save();
    if (!req.user.schoolId) await User.findByIdAndUpdate(req.user._id, { schoolId: student.schoolId });
    return success(res, { student: { fullName: student.fullName, studentId: student.studentId, class: student.class, accountNumber: student.virtualAccount?.accountNumber||null, bankName: student.virtualAccount?.bankName||null } }, `${student.fullName} successfully linked to your account`);
  } catch (err) { return error(res); }
};

const unlinkChild = async (req, res) => {
  try {
    const student = await assertOwns(req.user._id, req.params.studentId);
    if (!student) return notFound(res, 'Child not found or not linked to your account');
    student.parentId = null;
    await student.save();
    return success(res, null, `${student.fullName} unlinked from your account`);
  } catch (err) { return error(res); }
};

const getNotifications = async (req, res) => {
  try {
    const { Notification } = require('../models/WebhookLog');
    const { skip, limit, buildPagination } = paginate(req.query);
    const filter = { userId: req.user._id };
    if (req.query.unread === 'true') filter.read = false;
    const [notifications, total] = await Promise.all([Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), Notification.countDocuments(filter)]);
    const unreadIds = notifications.filter(n=>!n.read).map(n=>n._id);
    if (unreadIds.length) await Notification.updateMany({ _id:{$in:unreadIds} }, { read: true });
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });
    return paginated(res, { notifications, unreadCount }, buildPagination(total));
  } catch (err) { return error(res); }
};

module.exports = { getDashboard, getChildren, getChildAccount, getChildBalance, getChildPaymentHistory, linkChild, unlinkChild, getNotifications };
