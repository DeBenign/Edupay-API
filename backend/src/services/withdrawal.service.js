const crypto = require('crypto');
const Withdrawal = require('../models/Withdrawal');
const { getWithdrawableTotals } = require('./revenue.service');
const paystackService = require('./paystack.service');
const nombaService = require('./nomba.service');

const generateReference = () => `WD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const naira = (n) => `₦${Math.max(n, 0).toLocaleString()}`;

async function requestWithdrawal({ type, schoolId, amount, accountNumber, bankCode, accountName, gateway, requestedBy }) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount must be greater than 0');
  if (!['paystack', 'nomba'].includes(gateway)) throw new Error(`Unsupported gateway: ${gateway}`);
  if (type === 'school' && !schoolId) throw new Error('schoolId is required');

  const before = await getWithdrawableTotals({ type, schoolId });
  if (amount > before.earned - before.withdrawn) {
    throw new Error(`Requested amount exceeds available ${type} revenue (${naira(before.earned - before.withdrawn)})`);
  }

  const withdrawal = await Withdrawal.create({
    type, schoolId: schoolId || null, amount, accountNumber, bankCode, accountName,
    gateway, requestedBy, status: 'processing', reference: generateReference(),
  });

  // Reserve first, then verify. Concurrent requests count each other, so two clicks can never overdraw.
  const after = await getWithdrawableTotals({ type, schoolId });
  if (after.withdrawn > after.earned) {
    withdrawal.status = 'failed';
    withdrawal.failureReason = 'Insufficient balance (another withdrawal was in progress)';
    await withdrawal.save();
    throw new Error('Another withdrawal is in progress or the balance is insufficient. Try again in a moment.');
  }

  try {
    let transfer;
    if (gateway === 'paystack') {
      const recipient = await paystackService.createTransferRecipient({ accountNumber, bankCode, accountName });
      transfer = await paystackService.initiateTransfer({
        recipientCode: recipient.recipient_code, amount,
        reason: `EduPay ${type} withdrawal`, reference: withdrawal.reference,
      });
      withdrawal.status = transfer.status === 'success' ? 'completed' : 'processing';
    } else {
      transfer = await nombaService.initiateTransfer({
        amount, destinationAccount: accountNumber, destinationBankCode: bankCode,
        narration: `EduPay ${type} withdrawal`, reference: withdrawal.reference,
      });
      withdrawal.status = 'processing'; // stays processing until a payout webhook confirms it (not wired yet)
    }
    withdrawal.gatewayResponse = transfer;
    withdrawal.processedAt = withdrawal.status === 'completed' ? new Date() : null;
    await withdrawal.save();
  } catch (transferErr) {
    withdrawal.status = 'failed';
    withdrawal.failureReason = transferErr.message;
    await withdrawal.save();
    throw transferErr;
  }
  return withdrawal;
}

module.exports = { requestWithdrawal };