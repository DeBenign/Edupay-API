// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { env } = require('../config/env');
const { unauthorized } = require('../utils/apiResponse');

const protect = async (req, res, next) => {
  try {
    // 1. Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, 'No token provided. Please log in.');
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, env.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return unauthorized(res, 'Session expired. Please log in again.');
      }
      return unauthorized(res, 'Invalid token. Please log in.');
    }

    // 3. Check user still exists and is active
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return unauthorized(res, 'User account not found or deactivated.');
    }

    // 4. Attach user to request
    req.user = user;
    next();
  } catch (err) {
    console.error('❌ Auth middleware error:', err.message);
    return unauthorized(res);
  }
};

module.exports = { protect };
