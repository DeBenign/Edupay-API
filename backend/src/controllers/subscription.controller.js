const notify = require('../services/notify.service');
const School = require('../models/School');
const Student = require('../models/Student');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const { success, created, badRequest, notFound, error } = require('../utils/apiResponse');

const {
  DAY_MS, TERM_DAYS, RATE, PAY_TO, payToConfigured, priceFor, activeUntilOf, accessOf, invalidate, recordEnrolled, clearCache,
} = require('../services/subscriptionAccess.service');

const statusOf = (school, enrolled) => {
  const now = Date.now();
  const activeUntil = activeUntilOf(school);
  const paidUntil = school.subscription?.paidUntil ? new Date(school.subscription.paidUntil).getTime() : 0;
  const status = now > activeUntil ? 'due' : paidUntil >= now ? 'active' : 'pilot';
  const peakStudents = school.subscription?.peakStudents || 0;
  const price = priceFor(enrolled, peakStudents);
  const { locked, graceEndsAt, graceDays, extendedUntil } = accessOf(school, now);
  return {
    status, activeUntil: new Date(activeUntil), daysLeft: Math.ceil((activeUntil - now) / DAY_MS),
    locked, graceEndsAt, graceDays, extendedUntil,
    peakStudents, enrolledStudents: enrolled, ...price, pricePerTerm: price.amountDue, payTo: payToConfigured() ? PAY_TO : null,
  };
};

const countEnrolled = (schoolId) => Student.countDocuments({ schoolId, isActive: true });

const mySubscription = async (req, res) => {
  try {
    if (!req.user.schoolId) return notFound(res, 'No school');
    const enrolled = await countEnrolled(req.user.schoolId);
    await recordEnrolled(req.user.schoolId, enrolled);
    const school = await School.findById(req.user.schoolId).select('subscription createdAt');
    return success(res, { subscription: statusOf(school, enrolled) });
  } catch { return error(res); }
};

// Platform admin: every school with its status and what it owes
const listSubscriptions = async (req, res) => {
  try {
    const counts = await Student.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$schoolId', n: { $sum: 1 } } }]);
    const peakOps = counts.filter((c) => c.n > 0).map((c) => ({
      updateOne: { filter: { _id: c._id }, update: { $max: { 'subscription.peakStudents': c.n } } },
    }));
    if (peakOps.length) { await School.bulkWrite(peakOps); clearCache(); }
    const schools = await School.find({ isActive: true }).select('name email phone subscription createdAt').lean();
    const byId = new Map(counts.map((c) => [String(c._id), c.n]));
    return success(res, {
      schools: schools.map((s) => {
        const enrolled = byId.get(String(s._id)) || 0;
        return { schoolId: s._id, name: s.name, email: s.email, phone: s.phone, activeStudents: enrolled, ...statusOf(s, enrolled) };
      }),
    });
  } catch (err) { return error(res, err.message); }
};

// Platform admin: record a payment received from a school
const recordPayment = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const terms = Math.max(1, Math.floor(Number(req.body.terms) || 1));
    const reference = String(req.body.reference || '').trim();
    if (!Number.isFinite(amount) || amount <= 0 || !reference) return badRequest(res, 'amount and reference are required');

    const school = await School.findById(req.params.schoolId);
    if (!school) return notFound(res, 'School not found');

    const snapshot = statusOf(school, await countEnrolled(school._id));
    
    const due = snapshot.amountDue * terms;
    const note = String(req.body.note || '').trim();
    if (amount < due) {
      if (req.body.allowUnderpayment !== true) {
        return res.status(400).json({
          success: false, code: 'AMOUNT_BELOW_DUE', amountDue: due,
          message: `₦${amount.toLocaleString()} is below the ₦${due.toLocaleString()} due for ${terms} term${terms === 1 ? '' : 's'}.`,
        });
      }
      if (!note) return badRequest(res, 'A note explaining the reduced amount is required');
    }
    
    const start = Math.max(Date.now(), snapshot.activeUntil.getTime()); // paying early extends, never overlaps
    const coversUntil = new Date(start + terms * TERM_DAYS * DAY_MS);

    const payment = await SubscriptionPayment.create({
      schoolId: school._id, amount, terms, reference, coversUntil, note: note || undefined, recordedBy: req.user._id,
     studentsBilled: snapshot.billableStudents, ratePerStudent: RATE, amountDue: due,

    });
    // A new term starts: the peak restarts from today's active count
    await School.updateOne({ _id: school._id }, { $set: { 'subscription.paidUntil': coversUntil, 'subscription.peakStudents': snapshot.enrolledStudents } });
    invalidate(school._id)
    const fresh = await School.findById(school._id).select('subscription createdAt');
    await notify.subscriptionPaymentRecorded(school, payment); // never throws
    return created(res, { payment, subscription: statusOf(fresh, snapshot.enrolledStudents) }, 'Subscription payment recorded');
  } catch (err) {
    if (err.code === 11000) return badRequest(res, 'That reference was already recorded');
    return error(res, err.message);
  }
};

const extendAccess = async (req, res) => {
  try {
    const days = req.body.days === undefined ? 7 : Number(req.body.days);
    const note = String(req.body.note || '').trim();
    if (!Number.isInteger(days) || days < 1 || days > 30) return badRequest(res, 'days must be a whole number from 1 to 30');
    if (!note) return badRequest(res, 'A note explaining the extension is required');

    const school = await School.findById(req.params.schoolId).select('subscription createdAt');
    if (!school) return notFound(res, 'School not found');

    const current = school.subscription?.extendedUntil ? new Date(school.subscription.extendedUntil).getTime() : 0;
    const target = new Date(Math.max(Date.now() + days * DAY_MS, current)); // never shortens an existing extension
    await School.updateOne({ _id: school._id }, { $set: {
      'subscription.extendedUntil': target, 'subscription.extendedNote': note,
      'subscription.extendedBy': req.user._id, 'subscription.extendedAt': new Date(),
    } });
    invalidate(school._id);

    const [fresh, enrolled] = await Promise.all([
      School.findById(school._id).select('subscription createdAt'), countEnrolled(school._id),
    ]);
    return success(res, { subscription: statusOf(fresh, enrolled) }, `Access extended by ${days} day${days === 1 ? '' : 's'}`);
  } catch (err) { return error(res, err.message); }
};

module.exports = { mySubscription, listSubscriptions, recordPayment, extendAccess };