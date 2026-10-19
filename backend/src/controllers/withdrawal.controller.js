// src/controllers/withdrawal.controller.js
const Withdrawal = require('../models/Withdrawal');
const { requestWithdrawal } = require('../services/withdrawal.service');
const { withdrawalStatusMessage } = require('../utils/withdrawal.helpers');
const { success, created, error, forbidden, badRequest } = require('../utils/apiResponse');
const School = require('../models/School'); 
const { env } = require('../config/env');

const withdrawPlatformRevenue = async (req, res) => {
  try {
    const { amount, accountNumber, bankCode, accountName, gateway } = req.body;
    if (!amount || !accountNumber || !bankCode || !accountName) return badRequest(res, 'amount, accountNumber, bankCode, accountName are required');
    const withdrawal = await requestWithdrawal({
      type: 'platform', amount, accountNumber, bankCode, accountName,
      gateway: gateway || env.defaultPaymentGateway
    });
    return created(res, { withdrawal }, withdrawalStatusMessage(withdrawal.status)); // ← was hardcoded "processed" before, now honest too
  } catch (err) { return error(res, err.message); }
};

const withdrawSchoolRevenue = async (req, res) => {
  try {
    const { schoolId } = req.params;
    if (req.user.role !== 'admin' || req.user.schoolId?.toString() !== schoolId)
      return forbidden(res, 'Only the school admin can withdraw its revenue');

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return badRequest(res, 'amount must be a number greater than 0');

    const school = await School.findById(schoolId).select('payoutBank');
    const bank = school?.payoutBank;
    if (!bank?.accountNumber || !bank?.bankCode || !bank?.accountName)
      return badRequest(res, 'Save your payout bank account before requesting a withdrawal');

    const withdrawal = await requestWithdrawal({
      type: 'school', schoolId, amount,
      accountNumber: bank.accountNumber, bankCode: bank.bankCode, accountName: bank.accountName,
      gateway: env.defaultPaymentGateway, requestedBy: req.user._id,
    });
    return created(res, { withdrawal }, withdrawalStatusMessage(withdrawal.status));
  } catch (err) { return error(res, err.message); }
};

const schoolWithdrawalHistory = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const staff = ['admin', 'bursar'].includes(req.user.role) && req.user.schoolId?.toString() === schoolId;
    if (!staff && !req.platformAdmin) return forbidden(res, 'You can only view your own school\'s withdrawals');
    const withdrawals = await Withdrawal.find({ type: 'school', schoolId }).sort({ createdAt: -1 });
    return success(res, { withdrawals });
  } catch (err) { return error(res, err.message); }
};

const platformWithdrawalHistory = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ type: 'platform' }).sort({ createdAt: -1 });
    return success(res, { withdrawals });          // ← fixed: success(), plural, no undefined variable
  } catch (err) { return error(res, err.message); }
};

module.exports = { withdrawPlatformRevenue, withdrawSchoolRevenue, schoolWithdrawalHistory, platformWithdrawalHistory };