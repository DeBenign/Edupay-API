// src/middleware/auth.middleware.js
const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const { env } = require('../config/env');
const { unauthorized } = require('../utils/apiResponse');

const ALLOWED_WHILE_PENDING = new Set(['GET /api/auth/me', 'PATCH /api/auth/change-password']);

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, 'No token provided. Please log in.');
    }
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, env.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') return unauthorized(res, 'Session expired. Please log in again.');
      return unauthorized(res, 'Invalid token. Please log in.');
    }
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) return unauthorized(res, 'User account not found or deactivated.');
    if (user.mustChangePassword) {
      const path = req.originalUrl.split('?')[0].replace(/\/+$/, '');
      if (!ALLOWED_WHILE_PENDING.has(`${req.method} ${path}`)) {
        return res.status(403).json({
          success: false,
          code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'You must change your temporary password before continuing.',
        });
      }
    }
    req.user = user;
    next();
  } catch (err) {
    return unauthorized(res);
  }
};

module.exports = { protect };
