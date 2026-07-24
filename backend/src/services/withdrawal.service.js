// src/services/withdrawal.service.js
// Task 3: how each revenue "handler" (platform ops for platform revenue;
// a school's admin/bursar for that school's revenue) withdraws to a real
// bank account. Uses whichever gateway's transfer API you configure —
// this is independent of which gateway collected the original payments,
// since both settle into the same EduPay merchant balance.
const Withdrawal = require('../models/Withdrawal');
const { getPlatformRevenue, getSchoolRevenue } = require('./revenue.service');
const paystackService = require('./paystack.service');
const nombaService    = require('./nomba.service');

const requestWithdrawal = async ({
  type,               // 'platform' | 'school'
  schoolId = null,
  amount,
  accountNumber,
  bankCode,
  accountName,
  gateway = 'paystack',
  requestedBy,
}) => {
  // 1. Validate available balance so nobody withdraws more than has actually
  //    accrued — critical since this moves real money.
  const revenue = type === 'platform'
    ? await getPlatformRevenue()
    : await getSchoolRevenue(schoolId);

  if (amount > revenue.availableToWithdraw) {
    throw new Error(
      `Requested ₦${amount.toLocaleString()} exceeds available balance of ₦${revenue.availableToWithdraw.toLocaleString()}`
    );
  }

  const reference = `wd_${type}_${Date.now()}`;

  const withdrawal = await Withdrawal.create({
    type, schoolId, amount, accountNumber, bankCode, accountName,
    gateway, reference, requestedBy, status: 'processing',
  });

  // 2. Execute the actual transfer
  try {
    let gatewayResponse;

    if (gateway === 'paystack') {
      const recipient = await paystackService.createTransferRecipient({ accountNumber, bankCode, accountName });
      gatewayResponse = await paystackService.initiateTransfer({
        recipientCode: recipient.recipient_code,
        amount,
        reason: `EduPay ${type} revenue withdrawal`,
        reference,
      });
    } else {
      gatewayResponse = await nombaService.initiateTransfer({
        amount,
        destinationAccount: accountNumber,
        destinationBankCode: bankCode,
        narration: `EduPay ${type} revenue withdrawal`,
        reference,
      });
    }

    withdrawal.status = 'completed';
    withdrawal.gatewayResponse = gatewayResponse;
    withdrawal.processedAt = new Date();
    await withdrawal.save();
  } catch (err) {
    withdrawal.status = 'failed';
    withdrawal.failureReason = err.message;
    await withdrawal.save();
    throw err;
  }

  return withdrawal;
};

module.exports = { requestWithdrawal };