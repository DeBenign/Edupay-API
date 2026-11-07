const crypto = require('crypto');
const User = require('../models/User');
const Student = require('../models/Student');
const AuditLog = require('../models/AuditLog');
const { success, created, badRequest, notFound, error } = require('../utils/apiResponse');
const { MAX_ROWS, previewBulk, commitBulk } = require('../services/bulkParents.service');
const { paginate } = require('../utils/paginate');

// Explicit allow-list: never password, tokens, or link codes
const SAFE_FIELDS = 'fullName email phone role isActive createdAt lastLoginAt';
const esc = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const listByRole = (role) => async (req, res) => {
  try {
    const { skip, limit, buildPagination } = paginate(req.query);
    const filter = { schoolId: req.user.schoolId, role };   // school scoping is server-side
    if (req.query.search) {
      const rx = new RegExp(esc(req.query.search), 'i');
      filter.$or = [{ fullName: rx }, { email: rx }, { phone: rx }];
    }
    if (req.query.status === 'active') filter.isActive = true;
    if (req.query.status === 'inactive') filter.isActive = false;

    const [users, total] = await Promise.all([
      User.find(filter).select(SAFE_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    if (role === 'parent' && users.length) {
      const kids = await Student.find({
        schoolId: req.user.schoolId,
        parentId: { $in: users.map((u) => u._id) },
      }).select('fullName studentId class parentId').lean();
      const byParent = {};
      kids.forEach((k) => {
        (byParent[k.parentId] ||= []).push({ _id: k._id, fullName: k.fullName, studentId: k.studentId, class: k.class });
      });
      users.forEach((u) => { u.children = byParent[u._id] || []; });
    }

    return res.status(200).json({ success: true, data: { users }, pagination: buildPagination(total) });
  } catch (err) { return error(res, err.message); }
};

// Other schools' users return 404, not 403, so their existence isn't revealed
const findTarget = (req, roles) =>
  User.findOne({ _id: req.params.id, schoolId: req.user.schoolId, role: { $in: roles } });

const audit = (req, target, action) =>
  AuditLog.create({ actorId: req.user._id, schoolId: req.user.schoolId, targetId: target._id, action })
    .catch((e) => console.error('Audit log failed:', e.message));

const setActive = (isActive) => async (req, res) => {
  try {
    const target = await findTarget(req, ['bursar', 'parent']);   // admins can't touch admins
    if (!target) return notFound(res, 'User not found');
    target.isActive = isActive;
    await target.save();
    audit(req, target, isActive ? 'reactivate' : 'deactivate');
    return success(res, { id: target._id, isActive }, isActive ? 'Account reactivated' : 'Account deactivated');
  } catch (err) { return error(res, err.message); }
};

// Admin can reset a bursar's password but can never read the existing one
const resetBursarPassword = async (req, res) => {
  try {
    const target = await findTarget(req, ['bursar']);
    if (!target) return notFound(res, 'Bursar not found');
    const tempPassword = crypto.randomBytes(6).toString('base64url');
    target.password = tempPassword;          // relies on your pre-save bcrypt hook
    target.mustChangePassword = true;
    await target.save();
    audit(req, target, 'reset_password');
    return success(res, { tempPassword }, 'Password reset. Share the temporary password once.');
  } catch (err) { return error(res, err.message); }
};

// Parents can be added one by one (Staff page) or in bulk. Bursars are manual only: there is no bulk route for them.
const bulkParents = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    if (!schoolId) return badRequest(res, 'Admin must belong to a school first');
    const { rows, preview = false } = req.body || {};
    if (!Array.isArray(rows) || !rows.length) return badRequest(res, 'rows must be a non-empty array');
    if (rows.length > MAX_ROWS) return badRequest(res, `Upload at most ${MAX_ROWS} parents at a time`);

    if (preview) return success(res, await previewBulk(schoolId, rows), 'Preview ready');
    const result = await commitBulk(schoolId, rows);
    if (!result.createdCount) return badRequest(res, 'Nothing to import: every row has a problem', result.failed);
    // One audit entry per new account, then drop the internal id from what the browser receives
    await Promise.all(result.credentials.map((c) =>
      AuditLog.create({ actorId: req.user._id, schoolId, targetId: c.userId, action: 'bulk_create_parent' })
        .catch((e) => console.error('Audit log failed:', e.message))));
    result.credentials = result.credentials.map(({ userId, ...rest }) => rest);
    return created(res, result, `${result.createdCount} parent account(s) created. Share the temporary passwords now: they are shown once.`);
  } catch (err) {
    console.error('bulkParents error:', err.message);
    return error(res, err.message);
  }
};

module.exports = { listByRole, setActive, resetBursarPassword, bulkParents };