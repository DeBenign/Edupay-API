// src/services/subscriptionAccess.service.js
// Subscription pricing rules and the lock.
//
// A school is "locked" once its free pilot / paid period has ended AND the grace period has passed,
// unless the platform admin extended it. A locked school can still receive and reconcile parent
// payments and read its data, but cannot start new work (see middleware/subscription.middleware.js).
// Recording a payment moves paidUntil forward, which unlocks the school straight away.
const School = require('../models/School');

const DAY_MS = 24 * 60 * 60 * 1000;
const TERM_DAYS = 120;
const RATE    = Number(process.env.SUBSCRIPTION_PER_STUDENT) || 300;
const MINIMUM = Number(process.env.SUBSCRIPTION_MINIMUM) || 30000;
const PAY_TO = {
  bank:          process.env.SUBSCRIPTION_BANK_NAME      || 'GTBank',
  accountNumber: process.env.SUBSCRIPTION_ACCOUNT_NUMBER || '0222565760',
  accountName:   process.env.SUBSCRIPTION_ACCOUNT_NAME   || 'Yusuf Ibrahim',
};

// Days after the pilot / paid period ends before the lock starts (default 7)
const graceDays = () => {
  const raw = process.env.SUBSCRIPTION_GRACE_DAYS;
  const n = raw === undefined || raw === '' ? 7 : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 7;
};

// Per term: students × rate, never below the minimum.
// Students = the higher of the declared count and the enrolled count.
const priceFor = (declared, enrolled) => {
  const billableStudents = Math.max(declared || 0, enrolled || 0);
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
    ? { ...accessOf(school), declaredStudents: school.subscription?.declaredStudents || 0 }
    : { locked: false, missing: true };
  cache.set(key, { at: Date.now(), value });
  return value;
};

const invalidate = (schoolId) => cache.delete(String(schoolId));
const clearCache = () => cache.clear();

module.exports = {
  DAY_MS, TERM_DAYS, RATE, MINIMUM, PAY_TO,
  graceDays, priceFor, activeUntilOf, accessOf, getAccess, invalidate, clearCache,
};