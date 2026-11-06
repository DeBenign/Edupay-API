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
const TERM_DAYS = 120;   // how long one paid term covers (term + holiday)
const PILOT_DAYS = Number(process.env.PILOT_DAYS) || 90;   // free pilot, counted from the day EduPay approves a school
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
    : timeOf(school.createdAt) + PILOT_DAYS * DAY_MS;
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
    lockedFrom: new Date(lockedFrom),   // when the lock actually starts (grace end, or the admin extension if later)
    graceDays: grace,
    extendedUntil: extendedUntil ? new Date(extendedUntil) : null,
  };
};

// ── Countdown shown to both the school admin and the platform admin ─────────────
// Whole days, rounded up (3h left = "1 day left"), so nobody is told "0 days" while still active.
//   phase: pilot | active | grace | locked      tone: green | amber | red
//   daysLeft    days until the pilot / paid period ends (0 once it has ended)
//   overdueDays whole days since it ended (0 while active)
//   lockInDays  days until the school is locked (counts any extension EduPay gave)
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const daysUntil = (to, from) => Math.ceil((to - from) / DAY_MS);

const countdownOf = (school, now = Date.now()) => {
  const a = accessOf(school, now);
  const activeUntil = a.activeUntil.getTime();
  const lockedFrom = a.lockedFrom.getTime();
  const lockInDays = Math.max(0, daysUntil(lockedFrom, now));
  const overdueDays = now > activeUntil ? Math.floor((now - activeUntil) / DAY_MS) : 0;
  const ago = overdueDays === 0 ? 'today' : `${plural(overdueDays, 'day')} ago`;

  if (a.locked) {
    return { phase: 'locked', daysLeft: 0, overdueDays, lockInDays: 0, tone: 'red', label: `Locked · ended ${ago}` };
  }
  if (a.inGrace) {
    return {
      phase: 'grace', daysLeft: 0, overdueDays, lockInDays, tone: 'red',
      label: `Ended ${ago} · locks in ${plural(lockInDays, 'day')}`,
    };
  }
  const daysLeft = Math.max(0, daysUntil(activeUntil, now));
  const paid = timeOf(school.subscription?.paidUntil) >= now;
  return {
    phase: paid ? 'active' : 'pilot', daysLeft, overdueDays: 0, lockInDays,
    tone: daysLeft <= 3 ? 'red' : daysLeft <= 14 ? 'amber' : 'green',
    label: `${paid ? 'Subscription' : 'Pilot'}: ${plural(daysLeft, 'day')} left`,
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
  DAY_MS, TERM_DAYS, PILOT_DAYS, RATE, MINIMUM, PAY_TO, payToConfigured, recordEnrolled, trackPeak,
  graceDays, priceFor, activeUntilOf, accessOf, countdownOf, getAccess, invalidate, clearCache,
};