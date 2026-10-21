// src/middleware/platformAdmin.middleware.js

// Set PLATFORM_ADMIN_EMAILS in your env as a comma-separated list of the
// EduPay team's own login emails.
const { forbidden } = require('../utils/apiResponse');

const PLATFORM_ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const isPlatformAdminEmail = (email) => PLATFORM_ADMIN_EMAILS.includes((email || '').toLowerCase());

const requirePlatformAdmin = (req, res, next) => {
  if (!PLATFORM_ADMIN_EMAILS.length) {
    return forbidden(res, 'No platform admins configured — set PLATFORM_ADMIN_EMAILS');
  }
  if (!PLATFORM_ADMIN_EMAILS.includes((req.user?.email || '').toLowerCase())) {
    return forbidden(res, 'Platform admin access required');
  }
  next();
};

// Non-blocking version — tags req.platformAdmin instead of rejecting, for
// routes where EITHER a school's own admin OR a platform admin may proceed
// (the controller decides based on the tag).
const tagPlatformAdmin = (req, res, next) => {
  req.platformAdmin = PLATFORM_ADMIN_EMAILS.includes((req.user?.email || '').toLowerCase());
  next();
};

module.exports = { requirePlatformAdmin, tagPlatformAdmin, isPlatformAdminEmail };
