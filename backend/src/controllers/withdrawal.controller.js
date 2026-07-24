// src/controllers/withdrawal.controller.js
const Withdrawal = require('../models/Withdrawal');
const { requestWithdrawal } = require('../services/withdrawal.service');
const { success, created, error, forbidden, badRequest } = require('../utils/apiResponse');

// POST /api/withdrawals/platform — platform admin only (route-gated)
const withdrawPlatformRevenue = async (req, res) => {
  try {
    const { amount, accountNumber, bankCode, accountName, gateway } = req.body;
    if (!amount || !accountNumber || !bankCode || !accountName) return badRequest(res, 'amount, accountNumber, bankCode, accountName are required');
    const withdrawal = await requestWithdrawal({
      type: 'platform', amount, accountNumber, bankCode, accountName,
      gateway: gateway || 'paystack', requestedBy: req.user._id,
    });
    return created(res, { withdrawal }, 'Platform withdrawal processed');
  } catch (err) { return error(res, err.message); }
};

// POST /api/withdrawals/schools/:schoolId — that school's own admin/bursar,
// paying out to whichever bank account the school itself provides.
const withdrawSchoolRevenue = async (req, res) => {
  try {
    const { schoolId } = req.params;
    if (req.user.schoolId?.toString() !== schoolId) {
      return forbidden(res, 'You can only withdraw your own school\'s revenue');
    }
    const { amount, accountNumber, bankCode, accountName, gateway } = req.body;
    if (!amount || !accountNumber || !bankCode || !accountName) return badRequest(res, 'amount, accountNumber, bankCode, accountName are required');
    const withdrawal = await requestWithdrawal({
      type: 'school', schoolId, amount, accountNumber, bankCode, accountName,
      gateway: gateway || 'paystack', requestedBy: req.user._id,
    });
    return created(res, { withdrawal }, 'School withdrawal processed');
  } catch (err) { return error(res, err.message); }
};

// GET /api/withdrawals/schools/:schoolId — withdrawal history for a school
const schoolWithdrawalHistory = async (req, res) => {
  try {
    const { schoolId } = req.params;
    if (req.user.schoolId?.toString() !== schoolId && !req.platformAdmin) {
      return forbidden(res, 'You can only view your own school\'s withdrawals');
    }
    const withdrawals = await Withdrawal.find({ type: 'school', schoolId }).sort({ createdAt: -1 });
    return success(res, { withdrawals });
  } catch (err) { return error(res, err.message); }
};

module.exports = { withdrawPlatformRevenue, withdrawSchoolRevenue, schoolWithdrawalHistory };