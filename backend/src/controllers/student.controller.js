// src/controllers/student.controller.js
const Student = require('../models/Student');
const FeeStructure = require('../models/FeeStructure');
const FeeAssignment = require('../models/FeeAssignment');
const {
  provisionStudentVirtualAccount,
  retryVirtualAccountProvisioning,
} = require('../services/virtualAccount.service');
const { paginate } = require('../utils/paginate');
const {
  success, created, badRequest, notFound, error, forbidden, paginated,
} = require('../utils/apiResponse');

// ─── POST /api/students ───────────────────────────────────────────────────────
// Admin/Bursar enrolls a new student.
// Triggers virtual account provisioning automatically after creation.
const enrollStudent = async (req, res) => {
  try {
    const { fullName, studentId, class: studentClass, gender, dateOfBirth, parentId } = req.body;

    if (!fullName || !studentId || !studentClass || !gender) {
      return badRequest(res, 'fullName, studentId, class, and gender are required');
    }

    if (!['male', 'female'].includes(gender)) {
      return badRequest(res, 'gender must be "male" or "female"');
    }

    const schoolId = req.user.schoolId;
    if (!schoolId) return badRequest(res, 'Admin must belong to a school first');

    // Check for duplicate studentId within the same school
    const existing = await Student.findOne({ schoolId, studentId });
    if (existing) {
      return badRequest(res, `Student ID "${studentId}" already exists in this school`);
    }

    // 1. Create the student record
    const student = await Student.create({
      schoolId,
      fullName,
      studentId,
      class: studentClass,
      gender,
      ...(dateOfBirth && { dateOfBirth }),
      ...(parentId    && { parentId }),
    });

    // 2. Provision virtual account (async — non-blocking to response)
    //    We provision it and return the updated record if successful,
    //    or return the student anyway with a warning if provisioning fails.
    let finalStudent = student;
    let accountWarning = null;

    try {
      finalStudent = await provisionStudentVirtualAccount(student);
    } catch (provisionErr) {
      accountWarning = `Student enrolled but virtual account provisioning failed: ${provisionErr.message}. Use the retry endpoint to provision.`;
      console.warn('⚠️ ', accountWarning);
    }

    return created(
      res,
      { student: finalStudent, ...(accountWarning && { warning: accountWarning }) },
      accountWarning ? 'Student enrolled (virtual account pending)' : 'Student enrolled successfully'
    );
  } catch (err) {
    console.error('❌ enrollStudent error:', err.message);
    return error(res, err.message);
  }
};

// ─── GET /api/students ────────────────────────────────────────────────────────
// Paginated list of students for the school. Supports class and status filters.
const getStudents = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    if (!schoolId) return badRequest(res, 'Not associated with a school');

    const { skip, limit, buildPagination } = paginate(req.query);

    // Build filter
    const filter = { schoolId, isActive: true };
    if (req.query.class)  filter.class = req.query.class;
    if (req.query.search) {
      filter.$or = [
        { fullName:  { $regex: req.query.search, $options: 'i' } },
        { studentId: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [students, totalCount] = await Promise.all([
      Student.find(filter)
        .populate('parentId', 'fullName email phone')
        .sort({ fullName: 1 })
        .skip(skip)
        .limit(limit),
      Student.countDocuments(filter),
    ]);

    return paginated(res, { students }, buildPagination(totalCount));
  } catch (err) {
    console.error('❌ getStudents error:', err.message);
    return error(res);
  }
};

// ─── GET /api/students/:id ────────────────────────────────────────────────────
const getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('parentId', 'fullName email phone')
      .populate('schoolId', 'name');

    if (!student) return notFound(res, 'Student not found');

    // Parents can only view their own child
    if (
      req.user.role === 'parent' &&
      student.parentId?._id.toString() !== req.user._id.toString()
    ) {
      return forbidden(res, 'Access denied. This student is not linked to your account.');
    }

    // Fetch the student's current fee assignments for a full overview
    const feeAssignments = await FeeAssignment.find({ studentId: student._id })
      .populate('feeStructureId', 'name term academicSession amount dueDate')
      .sort({ createdAt: -1 });

    return success(res, { student, feeAssignments });
  } catch (err) {
    console.error('❌ getStudent error:', err.message);
    return error(res);
  }
};

// ─── PATCH /api/students/:id ──────────────────────────────────────────────────
const updateStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return notFound(res, 'Student not found');

    // Ensure student belongs to the user's school
    if (student.schoolId.toString() !== req.user.schoolId?.toString()) {
      return forbidden(res, 'Access denied');
    }

    const allowed = ['fullName', 'class', 'gender', 'dateOfBirth', 'parentId'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) student[field] = req.body[field];
    });

    await student.save();

    return success(res, { student }, 'Student updated successfully');
  } catch (err) {
    console.error('❌ updateStudent error:', err.message);
    return error(res);
  }
};

// ─── DELETE /api/students/:id ─────────────────────────────────────────────────
// Soft delete only — payment history must be preserved
const deactivateStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return notFound(res, 'Student not found');

    if (student.schoolId.toString() !== req.user.schoolId?.toString()) {
      return forbidden(res, 'Access denied');
    }

    student.isActive = false;
    await student.save();

    return success(res, null, 'Student deactivated. Payment records preserved.');
  } catch (err) {
    console.error('❌ deactivateStudent error:', err.message);
    return error(res);
  }
};

// ─── POST /api/students/:id/provision-account ────────────────────────────────
// Admin/Bursar retries virtual account provisioning for a student
const retryAccountProvisioning = async (req, res) => {
  try {
    const updatedStudent = await retryVirtualAccountProvisioning(req.params.id);

    return success(
      res,
      { student: updatedStudent },
      `Virtual account provisioned: ${updatedStudent.virtualAccount.accountNumber}`
    );
  } catch (err) {
    console.error('❌ retryAccountProvisioning error:', err.message);
    return error(res, err.message);
  }
};

// ─── GET /api/students/:id/account ───────────────────────────────────────────
// Returns the student's virtual account details (for parent to make payment)
const getStudentAccount = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).select('fullName studentId virtualAccount class');
    if (!student) return notFound(res, 'Student not found');

    // Parents can only view their own child
    if (req.user.role === 'parent') {
      const fullStudent = await Student.findById(req.params.id);
      if (fullStudent.parentId?.toString() !== req.user._id.toString()) {
        return forbidden(res, 'Access denied');
      }
    }

    if (!student.virtualAccount?.accountNumber) {
      return notFound(
        res,
        'Virtual account not yet provisioned for this student. Contact the school.'
      );
    }

    return success(res, {
      studentName:   student.fullName,
      studentId:     student.studentId,
      class:         student.class,
      accountNumber: student.virtualAccount.accountNumber,
      accountName:   student.virtualAccount.accountName,
      bankName:      student.virtualAccount.bankName,
    }, 'Transfer fees to this account number');
  } catch (err) {
    console.error('❌ getStudentAccount error:', err.message);
    return error(res);
  }
};

module.exports = {
  enrollStudent,
  getStudents,
  getStudent,
  updateStudent,
  deactivateStudent,
  retryAccountProvisioning,
  getStudentAccount,
};
