// src/controllers/fee.controller.js
const FeeStructure = require('../models/FeeStructure');
const FeeAssignment = require('../models/FeeAssignment');
const Student = require('../models/Student');
const { success, created, badRequest, notFound, error, forbidden } = require('../utils/apiResponse');

// ─── POST /api/fees/structures ────────────────────────────────────────────────
// Admin creates a fee structure for a class + term
const createFeeStructure = async (req, res) => {
  try {
    const { name, class: studentClass, amount, academicSession, term, dueDate } = req.body;

    if (!name || !studentClass || !amount || !academicSession || !term || !dueDate) {
      return badRequest(res, 'name, class, amount, academicSession, term, and dueDate are required');
    }

    if (!['first', 'second', 'third'].includes(term)) {
      return badRequest(res, 'term must be "first", "second", or "third"');
    }

    if (amount <= 0) return badRequest(res, 'amount must be greater than 0');

    const feeStructure = await FeeStructure.create({
      schoolId: req.user.schoolId,
      name,
      class: studentClass,
      amount,
      academicSession,
      term,
      dueDate,
      createdBy: req.user._id,
    });

    return created(res, { feeStructure }, 'Fee structure created successfully');
  } catch (err) {
    if (err.code === 11000) {
      return badRequest(
        res,
        'A fee structure already exists for this class, term, and academic session'
      );
    }
    console.error('❌ createFeeStructure error:', err.message);
    return error(res);
  }
};

// ─── GET /api/fees/structures ─────────────────────────────────────────────────
const getFeeStructures = async (req, res) => {
  try {
    const filter = { schoolId: req.user.schoolId };
    if (req.query.class)           filter.class           = req.query.class;
    if (req.query.term)            filter.term            = req.query.term;
    if (req.query.academicSession) filter.academicSession = req.query.academicSession;
    if (req.query.isActive)        filter.isActive        = req.query.isActive === 'true';

    const feeStructures = await FeeStructure.find(filter)
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 });

    return success(res, { feeStructures });
  } catch (err) {
    console.error('❌ getFeeStructures error:', err.message);
    return error(res);
  }
};

// ─── GET /api/fees/structures/:id ─────────────────────────────────────────────
const getFeeStructure = async (req, res) => {
  try {
    const feeStructure = await FeeStructure.findById(req.params.id)
      .populate('createdBy', 'fullName');

    if (!feeStructure) return notFound(res, 'Fee structure not found');

    // Ensure it belongs to the user's school
    if (feeStructure.schoolId.toString() !== req.user.schoolId?.toString()) {
      return forbidden(res, 'Access denied');
    }

    return success(res, { feeStructure });
  } catch (err) {
    console.error('❌ getFeeStructure error:', err.message);
    return error(res);
  }
};

// ─── PATCH /api/fees/structures/:id ──────────────────────────────────────────
const updateFeeStructure = async (req, res) => {
  try {
    const feeStructure = await FeeStructure.findById(req.params.id);
    if (!feeStructure) return notFound(res, 'Fee structure not found');

    if (feeStructure.schoolId.toString() !== req.user.schoolId?.toString()) {
      return forbidden(res, 'Access denied');
    }

    const allowed = ['name', 'amount', 'dueDate', 'isActive'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) feeStructure[field] = req.body[field];
    });

    await feeStructure.save();

    return success(res, { feeStructure }, 'Fee structure updated successfully');
  } catch (err) {
    console.error('❌ updateFeeStructure error:', err.message);
    return error(res);
  }
};

// ─── POST /api/fees/assign ────────────────────────────────────────────────────
// Assign a fee structure to a single student
const assignFeeToStudent = async (req, res) => {
  try {
    const { studentId, feeStructureId } = req.body;

    if (!studentId || !feeStructureId) {
      return badRequest(res, 'studentId and feeStructureId are required');
    }

    const [student, feeStructure] = await Promise.all([
      Student.findById(studentId),
      FeeStructure.findById(feeStructureId),
    ]);

    if (!student)      return notFound(res, 'Student not found');
    if (!feeStructure) return notFound(res, 'Fee structure not found');

    // Check class match
    if (student.class !== feeStructure.class) {
      return badRequest(
        res,
        `Class mismatch: student is in "${student.class}" but fee structure is for "${feeStructure.class}"`
      );
    }

    // Idempotency: don't create duplicate assignment
    const existing = await FeeAssignment.findOne({ studentId, feeStructureId });
    if (existing) {
      return badRequest(res, 'Fee already assigned to this student for this term');
    }

    const assignment = await FeeAssignment.create({
      studentId,
      schoolId: req.user.schoolId,
      feeStructureId,
      amountExpected: feeStructure.amount,
      balance: feeStructure.amount,
    });

    return created(res, { assignment }, 'Fee assigned to student successfully');
  } catch (err) {
    console.error('❌ assignFeeToStudent error:', err.message);
    return error(res);
  }
};

// ─── POST /api/fees/assign-class ─────────────────────────────────────────────
// Bulk assign a fee structure to ALL students in a class.
// This is the most common operation: "assign first term fees to all JSS 1 students"
const assignFeeToClass = async (req, res) => {
  try {
    const { feeStructureId } = req.body;

    if (!feeStructureId) return badRequest(res, 'feeStructureId is required');

    const feeStructure = await FeeStructure.findById(feeStructureId);
    if (!feeStructure) return notFound(res, 'Fee structure not found');

    // Fetch all active students in the matching class
    const students = await Student.find({
      schoolId: req.user.schoolId,
      class: feeStructure.class,
      isActive: true,
    });

    if (students.length === 0) {
      return notFound(res, `No active students found in class "${feeStructure.class}"`);
    }

    // Build bulk insert docs, skipping already-assigned students
    const existingAssignments = await FeeAssignment.find({
      feeStructureId,
      studentId: { $in: students.map((s) => s._id) },
    }).select('studentId');

    const alreadyAssigned = new Set(existingAssignments.map((a) => a.studentId.toString()));

    const newAssignments = students
      .filter((s) => !alreadyAssigned.has(s._id.toString()))
      .map((s) => ({
        studentId:       s._id,
        schoolId:        req.user.schoolId,
        feeStructureId,
        amountExpected:  feeStructure.amount,
        balance:         feeStructure.amount,
      }));

    if (newAssignments.length === 0) {
      return badRequest(res, 'All students in this class already have this fee assigned');
    }

    await FeeAssignment.insertMany(newAssignments, { ordered: false });

    return created(
      res,
      {
        assigned:  newAssignments.length,
        skipped:   alreadyAssigned.size,
        total:     students.length,
      },
      `Fee assigned to ${newAssignments.length} student(s) in ${feeStructure.class}`
    );
  } catch (err) {
    console.error('❌ assignFeeToClass error:', err.message);
    return error(res);
  }
};

// ─── GET /api/fees/assignments/:studentId ─────────────────────────────────────
// Get all fee assignments for a student
const getStudentFeeAssignments = async (req, res) => {
  try {
    const assignments = await FeeAssignment.find({ studentId: req.params.studentId })
      .populate('feeStructureId', 'name term academicSession amount dueDate')
      .sort({ createdAt: -1 });

    return success(res, { assignments });
  } catch (err) {
    console.error('❌ getStudentFeeAssignments error:', err.message);
    return error(res);
  }
};

module.exports = {
  createFeeStructure,
  getFeeStructures,
  getFeeStructure,
  updateFeeStructure,
  assignFeeToStudent,
  assignFeeToClass,
  getStudentFeeAssignments,
};
