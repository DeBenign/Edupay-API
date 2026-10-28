// src/controllers/fee.controller.js
const FeeStructure  = require('../models/FeeStructure');
const FeeAssignment = require('../models/FeeAssignment');
const Student       = require('../models/Student');
const AuditLog      = require('../models/AuditLog');
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
   if (err.code === 11000) return badRequest(res, 'A fee with this name already exists for this class, term, and session');
    return error(res, err.message);
  }
};

const getFeeStructures = async (req, res) => {
  try {
    const filter = { schoolId: req.user.schoolId };
    if (req.query.class) filter.class = req.query.class;
    if (req.query.term)  filter.term  = req.query.term;
    if (req.query.includeStudentOnly !== 'true') filter.studentOnly = { $ne: true };
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
    const mine = req.user.schoolId?.toString();
    if (student.schoolId.toString() !== mine || fs.schoolId.toString() !== mine) return forbidden(res, 'Access denied');
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
    if (fs.schoolId.toString() !== req.user.schoolId?.toString()) return forbidden(res, 'Access denied');
    if (fs.studentOnly) return badRequest(res, 'This fee is student-specific and cannot be assigned to a whole class');
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

// src/controllers/fee.controller.js
const adjustFeeAmount = async (req, res) => {
  try {
    const newAmount = Number(req.body.newAmountExpected);
    const { reason } = req.body;
    if (!Number.isFinite(newAmount) || newAmount <= 0)
      return badRequest(res, 'newAmountExpected must be a number greater than 0');
    if (!reason?.trim() || reason.trim().length < 5) return badRequest(res, 'A reason of at least 5 characters is required for a manual fee adjustment (audit trail)');

    const assignment = await FeeAssignment.findById(req.params.id);
    if (!assignment) return notFound(res, 'Fee assignment not found');
    if (assignment.schoolId.toString() !== req.user.schoolId?.toString()) return forbidden(res, 'Access denied');
    if (['paid', 'overpaid'].includes(assignment.status))
      return badRequest(res, 'Cannot adjust an assignment that is already fully paid or overpaid');

    const oldAmount = assignment.amountExpected;
    if (req.user.role === 'bursar' && newAmount >= oldAmount)
      return forbidden(res, 'Bursars can only reduce a fee. Ask a school admin to raise it.');
    const diff = newAmount - assignment.totalPaid;

    assignment.amountExpected = newAmount;
    assignment.balance        = Math.max(diff, 0);
    assignment.overpayment    = Math.max(-diff, 0);
    assignment.status = diff > 0 ? (assignment.totalPaid > 0 ? 'partial' : 'unpaid')
                      : diff === 0 ? 'paid' : 'overpaid';
    if (diff < 0) assignment.overpaymentResolution = 'pending';

    assignment.notes = `${assignment.notes ? assignment.notes + ' | ' : ''}Adjusted by ${req.user.fullName || req.user._id} from ₦${oldAmount} to ₦${newAmount} (${new Date().toISOString()}): ${reason.trim()}`;
    await assignment.save();

    try {
      await AuditLog.create({
        actorId: req.user._id, schoolId: assignment.schoolId, targetId: assignment._id, targetType: 'FeeAssignment',
        action: 'fee_adjust',
        meta: { studentId: assignment.studentId, oldAmount, newAmount, totalPaid: assignment.totalPaid, reason: reason.trim(), role: req.user.role },
      });
    } catch (auditErr) { console.error('❌ Fee adjustment saved but audit log failed:', auditErr.message); }

    return success(res, { assignment }, 'Fee amount adjusted successfully');
  } catch (err) { return error(res, err.message); }
};

// POST /api/fees/assign-custom
// { studentId, name, amount, reason?, term?, academicSession?, dueDate? }
const addFeeToStudent = async (req, res) => {
  try {
    const { studentId, name, reason, term, academicSession, dueDate } = req.body;
    const amount = Number(req.body.amount);
    if (!studentId || !name?.trim()) return badRequest(res, 'studentId and name are required');
    if (!Number.isFinite(amount) || amount <= 0) return badRequest(res, 'amount must be a number greater than 0');
    if (term && !['first','second','third'].includes(term)) return badRequest(res, 'term must be first, second, or third');

    const student = await Student.findById(studentId);
    if (!student) return notFound(res, 'Student not found');
    if (student.schoolId.toString() !== req.user.schoolId?.toString()) return forbidden(res, 'Access denied');

    // Anything not supplied falls back to the student's latest term
    let ctx = { term, academicSession, dueDate };
    if (!ctx.term || !ctx.academicSession || !ctx.dueDate) {
      const latest = await FeeAssignment.findOne({ studentId }).sort({ createdAt: -1 })
        .populate('feeStructureId', 'term academicSession dueDate');
      const fs = latest?.feeStructureId;
      ctx = {
        term:            ctx.term            || fs?.term,
        academicSession: ctx.academicSession || fs?.academicSession,
        dueDate:         ctx.dueDate         || fs?.dueDate,
      };
    }
    if (!ctx.term || !ctx.academicSession || !ctx.dueDate)
      return badRequest(res, 'This student has no fee history yet, so term, academicSession and dueDate are required');

    // Reuse the structure if this fee name already exists for the class/term/session
    const key = { schoolId: student.schoolId, class: student.class, term: ctx.term, academicSession: ctx.academicSession, name: name.trim() };
    let fs = await FeeStructure.findOne(key);
    if (!fs) {
      try {
        fs = await FeeStructure.create({ ...key, amount, dueDate: ctx.dueDate, studentOnly: true, createdBy: req.user._id });
      } catch (err) {
        if (err.code !== 11000) throw err;
        fs = await FeeStructure.findOne(key);
      }
    }
    if (!fs) return error(res, 'Could not create this fee. Run the one-time script scripts/syncFeeIndexes.js first.');

    if (await FeeAssignment.findOne({ studentId, feeStructureId: fs._id }))
      return badRequest(res, `${student.fullName} already has "${fs.name}" for ${ctx.term} term ${ctx.academicSession}. Use adjust to change the amount.`);

    const assignment = await FeeAssignment.create({
      studentId, schoolId: student.schoolId, feeStructureId: fs._id,
      amountExpected: amount, balance: amount,
      notes: `Added manually by ${req.user.fullName || req.user._id} (${new Date().toISOString()})${reason ? `: ${reason.trim()}` : ''}`,
    });

    return created(res, { assignment, feeStructure: fs, term: ctx.term, academicSession: ctx.academicSession },
      `Added "${fs.name}" (₦${amount.toLocaleString()}) for ${ctx.term} term ${ctx.academicSession}`);
  } catch (err) { return error(res, err.message); }
};

module.exports = { createFeeStructure, getFeeStructures, getFeeStructure, updateFeeStructure, assignFeeToStudent, assignFeeToClass, getStudentFeeAssignments, adjustFeeAmount, addFeeToStudent };
