// src/services/schoolApproval.service.js
// Is this user's school allowed to operate? Used by the auth middleware (every request)
// and by login / me (so the UI can show the right screen).
const School = require('../models/School');
const { isPlatformAdminEmail } = require('../middleware/platformAdmin.middleware');

const TTL_MS = 15 * 1000; // decisions reach every server instance within this time
const cache = new Map();

const BLOCKED = new Set(['pending', 'needs_info', 'rejected', 'suspended']);

const MESSAGES = {
  pending:    'Your school registration is awaiting EduPay approval.',
  needs_info: 'EduPay needs more information about your school. Update your details and resubmit.',
  rejected:   'Your school registration was not approved.',
  suspended:  'Your school account is suspended. Contact EduPay.',
};

// What a not-yet-approved school admin may still call: see their status,
// change their password, read and fix their own application.
const ALLOWED_WHILE_BLOCKED = [
  ['GET',   /^\/api\/auth\/me$/],
  ['PATCH', /^\/api\/auth\/change-password$/],
  ['GET',   /^\/api\/schools\/me$/],
  ['PATCH', /^\/api\/schools\/[a-f0-9]{24}$/],
  ['POST',  /^\/api\/schools\/my\/resubmit$/],
];

const clearApprovalCache = () => cache.clear();

// Legacy schools (no `approval` field) count as approved.
const getApproval = async (schoolId, { fresh = false } = {}) => {
  const key = String(schoolId);
  const hit = cache.get(key);
  if (!fresh && hit && hit.exp > Date.now()) return hit.value;
  const doc = await School.findById(schoolId).select('approval').lean();
  const value = doc
    ? { status: doc.approval?.status || 'approved', reason: doc.approval?.reason || null, message: doc.approval?.message || null }
    : null;
  cache.set(key, { value, exp: Date.now() + TTL_MS });
  return value;
};

// Returns null when the request may proceed, or the JSON body for a 403.
const gateFor = async (user, method, path) => {
  if (!user || user.role === 'parent') return null;          // parents never belong to a school account
  if (isPlatformAdminEmail(user.email)) return null;         // the EduPay owner is never blocked
  if (!user.schoolId) return null;                           // no school yet: nothing to operate
  const a = await getApproval(user.schoolId);
  if (!a || !BLOCKED.has(a.status)) return null;
  if (ALLOWED_WHILE_BLOCKED.some(([m, re]) => m === method && re.test(path))) return null;
  return { success: false, code: `SCHOOL_${a.status.toUpperCase()}`, status: a.status, message: MESSAGES[a.status] };
};

// For login / me: what the frontend needs to pick a screen.
const approvalInfoFor = async (user) => {
  if (user.role === 'parent' || isPlatformAdminEmail(user.email)) return { approvalStatus: 'approved' };
  const schoolId = user.schoolId?._id || user.schoolId;
  if (!schoolId) return { approvalStatus: user.role === 'admin' ? 'no_school' : 'approved' };
  const a = await getApproval(schoolId, { fresh: true });
  return { approvalStatus: a?.status || 'approved', approvalReason: a?.reason || null, approvalMessage: a?.message || null };
};

module.exports = { getApproval, gateFor, approvalInfoFor, clearApprovalCache, BLOCKED, MESSAGES };
