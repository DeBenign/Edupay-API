// src/middleware/errorHandler.js
const { env } = require('../config/env');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Internal Server Error';

  if (err.name  === 'ValidationError') { statusCode = 400; message = Object.values(err.errors).map(e => e.message).join(', '); }
  if (err.code  === 11000)             { statusCode = 409; message = `${Object.keys(err.keyValue)[0]} already exists`; }
  if (err.name  === 'CastError')       { statusCode = 400; message = `Invalid ${err.path}: ${err.value}`; }
  if (err.name  === 'JsonWebTokenError') { statusCode = 401; message = 'Invalid token'; }
  if (err.name  === 'TokenExpiredError') { statusCode = 401; message = 'Token expired'; }

  if (env.nodeEnv === 'development') console.error('❌ Error:', err);

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.nodeEnv === 'development' && { stack: err.stack }),
  });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

module.exports = { errorHandler, notFoundHandler };
