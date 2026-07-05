// src/controllers/fee.controller.js
const FeeStructure  = require('../models/FeeStructure');
const FeeAssignment = require('../models/FeeAssignment');
const Student       = require('../models/Student');
const { success, created, badRequest, notFound, error, forbidden } = require('../utils/apiResponse');

const createFeeStructure = async (req, res) => {
  try {
    const { name, class: cls, amount, academicSession, term, dueDate } = req.body;
    if (!name || !cls || !amount || !academicSession || !term || !dueDate) return badRequest(res, 'name, class, amount, academicSession, term, and dueDate are required');
    if (!['first','second','third'].includes(term)) return badRequest(res, 'term must be first, second, or third');
    if (amount <= 0) return badRequest(res, 'amount must be greater than 0');
    const feeStructure = await FeeStructure.create({ schoolId: req.user.schoolId, name, class: cls, amount, academicSession, term, dueDate, createdBy: req.user._id });
    return created(res, { feeStructure }, 'Fee structure created successfully');
  } catch (err) {
    if (err.code === 11000) return badRequest(res, 'A fee structure already exists for this class, term, and session');
    return error(res, err.message);
  }
};

const getFeeStructures = async (req, res) => {
  try {
    const filter = { schoolId: req.user.schoolId };
    if (req.query.class) filter.class = req.query.class;
    if (req.query.term)  filter.term  = req.query.term;
    const feeStructures = await FeeStructure.find(filter).populate('createdBy','fullName').sort({ createdAt: -1 });
    return success(res, { feeStructures });
  } catch (err) { return error(res); }
};

const getFeeStructure = async (req, res) => {
  try {
    const fs = await FeeStructure.findById(req.params.id).populate('createdBy','fullName');
    if (!fs) return notFound(res, 'Fee structure not found');
    if (fs.schoolId.toString() !== req.user.schoolId?.toString()) return forbidden(res, 'Access denied');
    return success(res, { feeStructure: fs });
  } catch (err) { return error(res); }
};

const updateFeeStructure = async (req, res) => {
  try {
    const fs = await FeeStructure.findById(req.params.id);
    if (!fs) return notFound(res, 'Fee structure not found');
    if (fs.schoolId.toString() !== req.user.schoolId?.toString()) return forbidden(res, 'Access denied');
    ['name','amount','dueDate','isActive'].forEach(f => { if (req.body[f] !== undefined) fs[f] = req.body[f]; });
    await fs.save();
    return success(res, { feeStructure: fs }, 'Fee structure updated successfully');
  } catch (err) { return error(res); }
};

const assignFeeToStudent = async (req, res) => {
  try {
    const { studentId, feeStructureId } = req.body;
    if (!studentId || !feeStructureId) return badRequest(res, 'studentId and feeStructureId are required');
    const [student, fs] = await Promise.all([Student.findById(studentId), FeeStructure.findById(feeStructureId)]);
    if (!student) return notFound(res, 'Student not found');
    if (!fs)      return notFound(res, 'Fee structure not found');
    const existing = await FeeAssignment.findOne({ studentId, feeStructureId });
    if (existing) return badRequest(res, 'Fee already assigned to this student for this term');
    const assignment = await FeeAssignment.create({ studentId, schoolId: req.user.schoolId, feeStructureId, amountExpected: fs.amount, balance: fs.amount });
    return created(res, { assignment }, 'Fee assigned to student successfully');
  } catch (err) { return error(res, err.message); }
};

const assignFeeToClass = async (req, res) => {
  try {
    const { feeStructureId } = req.body;
    if (!feeStructureId) return badRequest(res, 'feeStructureId is required');
    const fs = await FeeStructure.findById(feeStructureId);
    if (!fs) return notFound(res, 'Fee structure not found');
    const students = await Student.find({ schoolId: req.user.schoolId, class: fs.class, isActive: true });
    if (!students.length) return notFound(res, `No active students found in class "${fs.class}"`);
    const existingAssignments = await FeeAssignment.find({ feeStructureId, studentId: { $in: students.map(s => s._id) } }).select('studentId');
    const alreadyAssigned = new Set(existingAssignments.map(a => a.studentId.toString()));
    const newAssignments = students.filter(s => !alreadyAssigned.has(s._id.toString())).map(s => ({
      studentId: s._id, schoolId: req.user.schoolId, feeStructureId, amountExpected: fs.amount, balance: fs.amount,
    }));
    if (!newAssignments.length) return badRequest(res, 'All students in this class already have this fee assigned');
    await FeeAssignment.insertMany(newAssignments, { ordered: false });
    return created(res, { assigned: newAssignments.length, skipped: alreadyAssigned.size, total: students.length },
      `Fee assigned to ${newAssignments.length} student(s) in ${fs.class}`);
  } catch (err) { return error(res, err.message); }
};

const getStudentFeeAssignments = async (req, res) => {
  try {
    const assignments = await FeeAssignment.find({ studentId: req.params.studentId })
      .populate('feeStructureId','name term academicSession amount dueDate').sort({ createdAt: -1 });
    return success(res, { assignments });
  } catch (err) { return error(res); }
};

module.exports = { createFeeStructure, getFeeStructures, getFeeStructure, updateFeeStructure, assignFeeToStudent, assignFeeToClass, getStudentFeeAssignments };
