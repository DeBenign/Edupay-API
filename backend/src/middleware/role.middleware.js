// src/middleware/role.middleware.js
const { forbidden } = require('../utils/apiResponse');

/**
 * Role-based access control middleware.
 * Use after `protect` middleware.
 *
 * Usage: router.get('/admin-only', protect, authorize('admin'), handler)
 * Usage: router.get('/staff', protect, authorize('admin', 'bursar'), handler)
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return forbidden(res, 'Access denied. Not authenticated.');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return forbidden(
        res,
        `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${req.user.role}`
      );
    }

    next();
  };
};

/**
 * Ensures the user belongs to the school they're trying to access.
 * Pass schoolId as a route param (:schoolId) or in the request body.
 */
const requireSchoolAccess = (req, res, next) => {
  const schoolId = req.params.schoolId || req.body.schoolId;

  if (!schoolId) return next(); // No school context, let controller decide

  if (req.user.role !== 'admin' && req.user.schoolId?.toString() !== schoolId) {
    return forbidden(res, 'Access denied. You do not belong to this school.');
  }

  next();
};

module.exports = { authorize, requireSchoolAccess };
