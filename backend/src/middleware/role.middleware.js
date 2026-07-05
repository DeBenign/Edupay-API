// src/middleware/role.middleware.js
const { forbidden } = require('../utils/apiResponse');

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return forbidden(res, 'Not authenticated.');
  if (!allowedRoles.includes(req.user.role)) {
    return forbidden(res, `Access denied. Required: ${allowedRoles.join(', ')}. Yours: ${req.user.role}`);
  }
  next();
};

const requireSchoolAccess = (req, res, next) => {
  const schoolId = req.params.schoolId || req.body.schoolId;
  if (!schoolId) return next();
  if (req.user.role !== 'admin' && req.user.schoolId?.toString() !== schoolId) {
    return forbidden(res, 'Access denied. You do not belong to this school.');
  }
  next();
};

module.exports = { authorize, requireSchoolAccess };
