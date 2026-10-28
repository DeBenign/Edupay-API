// src/services/subscriptionAccess.service.js
// Subscription pricing rules and the lock.
//
// A school is "locked" once its free pilot / paid period has ended AND the grace period has passed,
// unless the platform admin extended it. A locked school can still receive and reconcile parent
// payments and read its data, but cannot start new work (see middleware/subscription.middleware.js).
// Recording a payment moves paidUntil forward, which unlocks the school straight away.
const School = require('../models/School');
const Student = require('../models/Student');

const DAY_MS = 24 * 60 * 60 * 1000;
const TERM_DAYS = 120;
const RATE    = Number(process.env.SUBSCRIPTION_PER_STUDENT) || 300;
const MINIMUM = Number(process.env.SUBSCRIPTION_MINIMUM) || 30000;
// Where schools send the subscription. Set in env only: nothing is hard-coded in the repo.
const PAY_TO = {
  bank:          process.env.SUBSCRIPTION_BANK_NAME      || null,
  accountNumber: process.env.SUBSCRIPTION_ACCOUNT_NUMBER || null,
  accountName:   process.env.SUBSCRIPTION_ACCOUNT_NAME   || null,
};
const payToConfigured = () => Boolean(PAY_TO.bank && PAY_TO.accountNumber && PAY_TO.accountName);

// Days after the pilot / paid period ends before the lock starts (default 7)
const graceDays = () => {
  const raw = process.env.SUBSCRIPTION_GRACE_DAYS;
  const n = raw === undefined || raw === '' ? 7 : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 7;
};

// Per term: students × rate, never below the minimum.
// Students = the higher of today's active count and the peak active count since the last payment,
// so deactivating students just before billing day does not lower the bill.
const priceFor = (enrolled, peak) => {
  const billableStudents = Math.max(enrolled || 0, peak || 0);
  return { billableStudents, ratePerStudent: RATE, minimum: MINIMUM, amountDue: Math.max(MINIMUM, billableStudents * RATE) };
};

const timeOf = (d) => (d ? new Date(d).getTime() : 0);

// When the pilot or the latest paid period ends (ms)
const activeUntilOf = (school) => {
  const pilotEnds = school.subscription?.pilotEndsAt
    ? timeOf(school.subscription.pilotEndsAt)
    : timeOf(school.createdAt) + TERM_DAYS * DAY_MS;
  return Math.max(pilotEnds, timeOf(school.subscription?.paidUntil));
};

const accessOf = (school, now = Date.now()) => {
  const activeUntil = activeUntilOf(school);
  const grace = graceDays();
  const graceEndsAt = activeUntil + grace * DAY_MS;
  const extendedUntil = timeOf(school.subscription?.extendedUntil);
  const lockedFrom = Math.max(graceEndsAt, extendedUntil);
  return {
    locked: now > lockedFrom,
    inGrace: now > activeUntil && now <= lockedFrom,
    activeUntil: new Date(activeUntil),
    graceEndsAt: new Date(graceEndsAt),
    graceDays: grace,
    extendedUntil: extendedUntil ? new Date(extendedUntil) : null,
  };
};

// ── Cached lookup used on every guarded request (a minute is plenty; payments clear it) ──
const TTL_MS = 60 * 1000;
const cache = new Map();

const getAccess = async (schoolId) => {
  const key = String(schoolId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const school = await School.findById(schoolId).select('subscription createdAt').lean();
  const value = school
    ? { ...accessOf(school), peakStudents: school.subscription?.peakStudents || 0 }
    : { locked: false, missing: true };
  cache.set(key, { at: Date.now(), value });
  return value;
};

const invalidate = (schoolId) => cache.delete(String(schoolId));
const clearCache = () => cache.clear();

// ── Peak active students (billing basis) ─────────────────────────────────────
const recordEnrolled = async (schoolId, count) => {
  if (!schoolId || !Number.isFinite(count) || count <= 0) return;
  await School.updateOne({ _id: schoolId }, { $max: { 'subscription.peakStudents': count } });
  invalidate(schoolId);
};
// Call after students are added and BEFORE any are deactivated. Never throws.
const trackPeak = async (schoolId) => {
  try {
    const n = await Student.countDocuments({ schoolId, isActive: true });
    await recordEnrolled(schoolId, n);
  } catch (err) { console.error('Peak student tracking failed:', err.message); }
};

module.exports = {
  DAY_MS, TERM_DAYS, RATE, MINIMUM, PAY_TO, payToConfigured, recordEnrolled, trackPeak,
  graceDays, priceFor, activeUntilOf, accessOf, getAccess, invalidate, clearCache,
};