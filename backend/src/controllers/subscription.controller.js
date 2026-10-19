const School = require('../models/School');
const Student = require('../models/Student');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const { success, created, badRequest, notFound, error } = require('../utils/apiResponse');

const DAY_MS = 24 * 60 * 60 * 1000;
const TERM_DAYS = 120;
const PRICE = Number(process.env.SUBSCRIPTION_PRICE_PER_TERM) || 50000;

const statusOf = (school) => {
  const now = Date.now();
  const pilotEnds = school.subscription?.pilotEndsAt
    ? new Date(school.subscription.pilotEndsAt).getTime()
    : new Date(school.createdAt).getTime() + TERM_DAYS * DAY_MS; // schools created before this feature
  const paidUntil = school.subscription?.paidUntil ? new Date(school.subscription.paidUntil).getTime() : 0;
  const activeUntil = Math.max(pilotEnds, paidUntil);
  const status = now > activeUntil ? 'due' : paidUntil >= now ? 'active' : 'pilot';
  return { status, activeUntil: new Date(activeUntil), daysLeft: Math.ceil((activeUntil - now) / DAY_MS), pricePerTerm: PRICE };
};

// Admin or bursar: their own school's status (drives the banner)
const mySubscription = async (req, res) => {
  try {
    if (!req.user.schoolId) return notFound(res, 'No school');
    const school = await School.findById(req.user.schoolId).select('subscription createdAt');
    return success(res, { subscription: statusOf(school) });
  } catch { return error(res); }
};

// Platform admin: every school, its status, and its student count
const listSubscriptions = async (req, res) => {
  try {
    const [schools, counts] = await Promise.all([
      School.find({ isActive: true }).select('name email phone subscription createdAt').lean(),
      Student.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$schoolId', n: { $sum: 1 } } }]),
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c.n]));
    return success(res, {
      schools: schools.map((s) => ({
        schoolId: s._id, name: s.name, email: s.email, phone: s.phone,
        activeStudents: byId.get(String(s._id)) || 0, ...statusOf(s),
      })),
    });
  } catch (err) { return error(res, err.message); }
};

// Platform admin: record a payment you received from a school
const recordPayment = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const terms = Math.max(1, Math.floor(Number(req.body.terms) || 1));
    const reference = String(req.body.reference || '').trim();
    if (!Number.isFinite(amount) || amount <= 0 || !reference) return badRequest(res, 'amount and reference are required');

    const school = await School.findById(req.params.schoolId);
    if (!school) return notFound(res, 'School not found');

    // Paying early extends from the end of the current cover, never overlaps it
    const start = Math.max(Date.now(), statusOf(school).activeUntil.getTime());
    const coversUntil = new Date(start + terms * TERM_DAYS * DAY_MS);

    const payment = await SubscriptionPayment.create({
      schoolId: school._id, amount, terms, reference, coversUntil, note: req.body.note, recordedBy: req.user._id,
    });
    school.subscription = { ...(school.subscription?.toObject?.() || {}), paidUntil: coversUntil };
    await school.save();

    return created(res, { payment, subscription: statusOf(school) }, 'Subscription payment recorded');
  } catch (err) {
    if (err.code === 11000) return badRequest(res, 'That reference was already recorded');
    return error(res, err.message);
  }
};

module.exports = { mySubscription, listSubscriptions, recordPayment };