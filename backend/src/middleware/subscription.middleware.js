// src/middleware/subscription.middleware.js
// Stops a school whose subscription has ended from starting new work.
// Put it after `protect` on routes that create things. Never put it on parent payments,
// webhooks, reconciliation, reads, or the subscription pages themselves.
const Student = require('../models/Student');
const { getAccess, priceFor, PAY_TO } = require('../services/subscriptionAccess.service');
const { isPlatformAdminEmail } = require('./platformAdmin.middleware');

const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' });

const requireActiveSubscription = async (req, res, next) => {
  let access;
  try {
    if (!req.user?.schoolId) return next();                   // no school yet, nothing to bill
    if (isPlatformAdminEmail(req.user.email)) return next();  // EduPay's own team is never locked out
    access = await getAccess(req.user.schoolId);
    if (!access.locked) return next();
  } catch (err) {
    // If the check itself breaks, keep the school working rather than lock it by mistake
    console.error('Subscription check failed, allowing the request:', err.message);
    return next();
  }

  let amountDue = null;
  try {
    const enrolled = await Student.countDocuments({ schoolId: req.user.schoolId, isActive: true });
    amountDue = priceFor(access.declaredStudents, enrolled).amountDue;
  } catch { /* the message just omits the amount */ }

  const pay = amountDue === null ? 'Pay your subscription' : `Pay ₦${amountDue.toLocaleString()}`;
  return res.status(402).json({
    success: false,
    code: 'SUBSCRIPTION_REQUIRED',
    amountDue,
    message:
      `Your EduPay subscription ended on ${fmtDate(access.activeUntil)}, so adding students, fees, staff and cash payments is paused. ` +
      `${pay} to ${PAY_TO.bank} ${PAY_TO.accountNumber} (${PAY_TO.accountName}) and your school reopens as soon as EduPay records it. ` +
      'Parent payments, balances and reports keep working.',
  });
};

module.exports = { requireActiveSubscription };