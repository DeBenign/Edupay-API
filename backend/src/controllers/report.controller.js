// src/controllers/report.controller.js
const {
  getSchoolSummary,
  getClassBreakdown,
  getOverpaymentsReport,
  getStudentStatement,
  getRecentPayments,
} = require('../services/report.service');
const { success, error, forbidden } = require('../utils/apiResponse');

// ─── GET /api/reports/summary ─────────────────────────────────────────────────
// School-wide collection totals. Supports ?term=first&academicSession=2024/2025
const schoolSummary = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    if (!schoolId) return forbidden(res, 'Not associated with a school');

    const { term, academicSession } = req.query;
    const [summary, school] = await Promise.all([
      getSchoolSummary(schoolId, { term, academicSession }),
      require('../models/School').findById(schoolId).select('name email').lean(),
    ]);

    return success(res, { school, collection: summary });
  } catch (err) {
    console.error('schoolSummary error:', err.message);
    return error(res);
  }
};

// ─── GET /api/reports/class ───────────────────────────────────────────────────
// Per-class breakdown. Supports same filters as summary.
const classBreakdown = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    if (!schoolId) return forbidden(res, 'Not associated with a school');

    const { term, academicSession } = req.query;
    const classes = await getClassBreakdown(schoolId, { term, academicSession });

    return success(res, { classes, count: classes.length });
  } catch (err) {
    console.error('classBreakdown error:', err.message);
    return error(res);
  }
};

// ─── GET /api/reports/overpayments ───────────────────────────────────────────
// All students with overpayment balance. Paginated.
const overpayments = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    if (!schoolId) return forbidden(res, 'Not associated with a school');

    const page  = parseInt(req.query.page,  10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const result = await getOverpaymentsReport(schoolId, { page, limit });
    return success(res, result);
  } catch (err) {
    console.error('overpayments error:', err.message);
    return error(res);
  }
};

// ─── GET /api/reports/student/:studentId/statement ────────────────────────────
// Full payment statement for one student across all terms.
const studentStatement = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    // Parents can only pull their own child's statement
    if (req.user.role === 'parent') {
      const Student = require('../models/Student');
      const student = await Student.findOne({
        _id:      req.params.studentId,
        parentId: req.user._id,
      });
      if (!student) return forbidden(res, 'Access denied');
    }

    const result = await getStudentStatement(req.params.studentId, schoolId);
    return success(res, result);
  } catch (err) {
    console.error('studentStatement error:', err.message);
    return error(res, err.message);
  }
};

// ─── GET /api/reports/recent ──────────────────────────────────────────────────
// Last 20 payments across the school — seeds the bursar live feed on page load.
const recentPayments = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    if (!schoolId) return forbidden(res, 'Not associated with a school');

    const limit    = parseInt(req.query.limit, 10) || 20;
    const payments = await getRecentPayments(schoolId, limit);

    return success(res, { payments, count: payments.length });
  } catch (err) {
    console.error('recentPayments error:', err.message);
    return error(res);
  }
};

module.exports = { schoolSummary, classBreakdown, overpayments, studentStatement, recentPayments };
