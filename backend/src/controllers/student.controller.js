// src/controllers/student.controller.js
const Student       = require('../models/Student');
const FeeAssignment = require('../models/FeeAssignment');
const { provisionStudentVirtualAccount, retryVirtualAccountProvisioning } = require('../services/virtualAccount.service');
const { paginate }  = require('../utils/paginate');
const { success, created, badRequest, notFound, error, forbidden, paginated } = require('../utils/apiResponse');

const enrollStudent = async (req, res) => {
  try {
    const { fullName, studentId, class: cls, gender, dateOfBirth, parentId } = req.body;
    if (!fullName || !studentId || !cls || !gender) return badRequest(res, 'fullName, studentId, class, and gender are required');
    if (!['male','female'].includes(gender)) return badRequest(res, 'gender must be male or female');
    const schoolId = req.user.schoolId;
    if (!schoolId) return badRequest(res, 'Admin must belong to a school first');
    const existing = await Student.findOne({ schoolId, studentId });
    if (existing) return badRequest(res, `Student ID "${studentId}" already exists in this school`);
    const student = await Student.create({ schoolId, fullName, studentId, class: cls, gender, ...(dateOfBirth && { dateOfBirth }), ...(parentId && { parentId }) });
    let finalStudent = student, accountWarning = null;
    try {
      finalStudent = await provisionStudentVirtualAccount(student);
    } catch (pe) {
      accountWarning = `Student enrolled but virtual account provisioning failed: ${pe.message}. Use retry endpoint.`;
    }
    return created(res, { student: finalStudent, ...(accountWarning && { warning: accountWarning }) },
      accountWarning ? 'Student enrolled (virtual account pending)' : 'Student enrolled successfully');
  } catch (err) {
    console.error('enrollStudent error:', err.message);
    return error(res, err.message);
  }
};

const getStudents = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    if (!schoolId) return badRequest(res, 'Not associated with a school');
    const { skip, limit, buildPagination } = paginate(req.query);
    const filter = { schoolId, isActive: true };
    if (req.query.class)  filter.class = req.query.class;
    if (req.query.search) filter.$or = [
      { fullName:  { $regex: req.query.search, $options: 'i' } },
      { studentId: { $regex: req.query.search, $options: 'i' } },
    ];
    const [students, total] = await Promise.all([
      Student.find(filter).populate('parentId','fullName email phone').sort({ fullName: 1 }).skip(skip).limit(limit),
      Student.countDocuments(filter),
    ]);
    return paginated(res, { students }, buildPagination(total));
  } catch (err) { return error(res); }
};

const getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('parentId','fullName email phone').populate('schoolId','name');
    if (!student) return notFound(res, 'Student not found');
    if (req.user.role === 'parent' && student.parentId?._id.toString() !== req.user._id.toString())
      return forbidden(res, 'Access denied');
    const feeAssignments = await FeeAssignment.find({ studentId: student._id })
      .populate('feeStructureId','name term academicSession amount dueDate').sort({ createdAt: -1 });
    return success(res, { student, feeAssignments });
  } catch (err) { return error(res); }
};

const updateStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return notFound(res, 'Student not found');
    if (student.schoolId.toString() !== req.user.schoolId?.toString()) return forbidden(res, 'Access denied');
    const allowed = ['fullName','class','gender','dateOfBirth','parentId'];
    allowed.forEach(f => { if (req.body[f] !== undefined) student[f] = req.body[f]; });
    await student.save();
    return success(res, { student }, 'Student updated successfully');
  } catch (err) { return error(res); }
};

const deactivateStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return notFound(res, 'Student not found');
    if (student.schoolId.toString() !== req.user.schoolId?.toString()) return forbidden(res, 'Access denied');
    student.isActive = false;
    await student.save();
    return success(res, null, 'Student deactivated. Payment records preserved.');
  } catch (err) { return error(res); }
};

const retryAccountProvisioning = async (req, res) => {
  try {
    const updatedStudent = await retryVirtualAccountProvisioning(req.params.id);
    return success(res, { student: updatedStudent }, `Virtual account provisioned: ${updatedStudent.virtualAccount.accountNumber}`);
  } catch (err) { return error(res, err.message); }
};

const getStudentAccount = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).select('fullName studentId virtualAccount class parentId');
    if (!student) return notFound(res, 'Student not found');
    if (req.user.role === 'parent' && student.parentId?.toString() !== req.user._id.toString())
      return forbidden(res, 'Access denied');
    if (!student.virtualAccount?.accountNumber)
      return notFound(res, 'Virtual account not yet provisioned. Contact the school.');
    return success(res, {
      studentName:   student.fullName,
      studentId:     student.studentId,
      class:         student.class,
      paymentDetails:{
        accountNumber: student.virtualAccount.accountNumber,
        accountName:   student.virtualAccount.accountName,
        bankName:      student.virtualAccount.bankName,
        instruction:   'Transfer fees to this account. Payment reconciles automatically.',
      },
    });
  } catch (err) { return error(res); }
};

module.exports = { enrollStudent, getStudents, getStudent, updateStudent, deactivateStudent, retryAccountProvisioning, getStudentAccount };