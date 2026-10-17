// src/controllers/student.controller.js
const Student       = require('../models/Student');
const FeeAssignment = require('../models/FeeAssignment');
const FeeStructure = require('../models/FeeStructure');
const { buildPaymentInstructions } = require('../services/paymentInstructions.service');
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
    // enrollStudent — inside student.controller.js
  let finalStudent = student, accountWarning = null;
  try {
    const { student: provisioned, errors } = await provisionStudentVirtualAccount(student);
    finalStudent = provisioned;
    if (errors.length) accountWarning = `Partial provisioning failure: ${errors.join('; ')}. Use retry endpoint.`;
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

const deriveFeeStatus = (assignments = []) => {
  if (!assignments.length) return { currentStatus: null, outstandingBalance: 0 };

  const open = assignments.filter((a) => ['unpaid', 'partial'].includes(a.status));
  const outstandingBalance = open.reduce((sum, a) => sum + (a.balance || 0), 0);

  if (open.length) return { currentStatus: open[0].status, outstandingBalance }; // list is sorted oldest-first
  if (assignments.some((a) => a.status === 'overpaid')) return { currentStatus: 'overpaid', outstandingBalance: 0 };
  return { currentStatus: 'paid', outstandingBalance: 0 };
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
      Student.find(filter).populate('parentId', 'fullName email phone').sort({ fullName: 1 }).skip(skip).limit(limit),
      Student.countDocuments(filter),
    ]);

    // One extra query for the whole page, not one per student
    const assignments = await FeeAssignment.find({ studentId: { $in: students.map((s) => s._id) } })
      .select('studentId status balance createdAt')
      .sort({ createdAt: 1 })
      .lean();

    const byStudent = new Map();
    for (const a of assignments) {
      const key = a.studentId.toString();
      if (!byStudent.has(key)) byStudent.set(key, []);
      byStudent.get(key).push(a);
    }

    const withStatus = students.map((s) => ({
      ...s.toObject(),
      ...deriveFeeStatus(byStudent.get(s._id.toString())),
    }));

    return paginated(res, { students: withStatus }, buildPagination(total));
  } catch (err) { return error(res); }
};

const getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('parentId','fullName email phone').populate('schoolId','name');
    if (!student) return notFound(res, 'Student not found');
    if (req.user.role === 'parent' && student.parentId?._id.toString() !== req.user._id.toString())
      return forbidden(res, 'Access denied');
    if (req.user.role !== 'parent' && student.schoolId?._id?.toString() !== req.user.schoolId?.toString())
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

// retryAccountProvisioning
const retryAccountProvisioning = async (req, res) => {
  try {
    const { student, errors } = await retryVirtualAccountProvisioning(req.params.id);
    return success(res, { student, ...(errors.length && { warning: errors.join('; ') }) },
      errors.length ? 'Partially provisioned' : 'Virtual accounts provisioned');
  } catch (err) { return error(res, err.message); }
};

const getStudentAccount = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .select('fullName studentId virtualAccounts class parentId schoolId');
    if (!student) return notFound(res, 'Student not found');

    if (req.user.role === 'parent') {
      if (student.parentId?.toString() !== req.user._id.toString()) return forbidden(res, 'Access denied');
    } else if (student.schoolId.toString() !== req.user.schoolId?.toString()) {
      return forbidden(res, 'Access denied');
    }

    const instructions = await buildPaymentInstructions(student);
    if (!instructions.paymentOptions.length)
      return notFound(res, 'Virtual account not yet provisioned. Contact the school.');

    return success(res, {
      studentName: student.fullName,
      studentId:   student.studentId,
      class:       student.class,
      ...instructions,
      instruction: 'Transfer the "amount to pay" shown to either account. Payment reconciles automatically.',
    });
  } catch (err) { return error(res); }
};

const normClass = (c = '') => String(c).toLowerCase().replace(/[^a-z0-9]/g, '');

// POST /api/students/promote-class  (admin only)
// { fromClass, toClass }  or  { fromClass, graduate: true }
// optional: studentIds (subset, e.g. to hold back repeaters), preview, force
const promoteClass = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    if (!schoolId) return badRequest(res, 'Not associated with a school');

    const { fromClass, toClass, graduate = false, studentIds, preview = false, force = false } = req.body;
    if (!fromClass?.trim()) return badRequest(res, 'fromClass is required');
    if (graduate && toClass) return badRequest(res, 'Provide either toClass or graduate: true, not both');
    if (!graduate && !toClass?.trim()) return badRequest(res, 'toClass is required (or set graduate: true)');
    if (!graduate && normClass(fromClass) === normClass(toClass))
      return badRequest(res, 'toClass must be different from fromClass');

    // Active students of this school whose class matches, ignoring formatting
    const active = await Student.find({ schoolId, isActive: true }).select('fullName studentId class');
    let targets = active.filter((s) => normClass(s.class) === normClass(fromClass));
    if (Array.isArray(studentIds) && studentIds.length) {
      const only = new Set(studentIds.map(String));
      targets = targets.filter((s) => only.has(s._id.toString()));
    }
    if (!targets.length) return notFound(res, `No active students found in "${fromClass}"`);

    // Who still owes? Their old assignments stay as they are.
    const open = await FeeAssignment.find({
      studentId: { $in: targets.map((s) => s._id) },
      status: { $in: ['unpaid', 'partial'] },
    }).select('studentId').lean();
    const owing = new Set(open.map((a) => a.studentId.toString()));

    const brief = (s) => ({ _id: s._id, fullName: s.fullName, studentId: s.studentId, class: s.class });
    const skippedOwing = graduate && !force ? targets.filter((s) => owing.has(s._id.toString())) : [];
    const skippedIds = new Set(skippedOwing.map((s) => s._id.toString()));
    const toProcess = targets.filter((s) => !skippedIds.has(s._id.toString()));

    if (!toProcess.length)
      return badRequest(res, 'Nobody to graduate: every matching student still has an outstanding fee. Use force: true to graduate them anyway.');

    // Use the label your fee structures use, so fee assignment matches exactly
    let finalClass = null;
    const warnings = [];
    if (!graduate) {
      const known = await FeeStructure.distinct('class', { schoolId });
      finalClass = known.find((c) => normClass(c) === normClass(toClass)) || toClass.trim();
      if (!known.some((c) => normClass(c) === normClass(toClass)))
        warnings.push(`No fee structure exists for "${toClass}" yet. Create one before assigning fees or crediting overpayments.`);
    }

    const summary = {
      action: graduate ? 'graduate' : 'promote',
      matchedLabels: [...new Set(targets.map((s) => s.class))],
      toClass: finalClass,
      count: toProcess.length,
      withOutstandingBalance: toProcess.filter((s) => owing.has(s._id.toString())).length,
      skippedOwing: skippedOwing.map(brief),
      warnings,
      students: toProcess.map(brief),
    };
    if (preview) return success(res, { preview: true, ...summary }, 'Preview only. No changes made.');

    const ids = toProcess.map((s) => s._id);
    await Student.updateMany(
      { _id: { $in: ids }, schoolId },
      { $set: graduate ? { isActive: false } : { class: finalClass } }
    );

    return success(res, summary,
      graduate ? `${ids.length} student(s) graduated` : `${ids.length} student(s) promoted to ${finalClass}`);
  } catch (err) { return error(res, err.message); }
};
module.exports = { enrollStudent, getStudents, getStudent, updateStudent, deactivateStudent, retryAccountProvisioning, getStudentAccount, promoteClass };