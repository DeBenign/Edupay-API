// src/middleware/role.middleware.js
const { forbidden } = require('../utils/apiResponse');

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return forbidden(res, 'Not authenticated.');
  if (!allowedRoles.includes(req.user.role)) {
    return forbidden(res, `Access denied. Required: ${allowedRoles.join(', ')}. Yours: ${req.user.role}`);
  }
  next();
};

module.exports = { authorize };
