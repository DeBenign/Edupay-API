const crypto = require('crypto');
const Withdrawal = require('../models/Withdrawal');
const { getSchoolRevenue, getPlatformRevenue } = require('./report.service');
const paystackService = require('./paystack.service');
// const nombaService = require('./nomba.service'); // wire in once its transfer flow is confirmed

function generateReference() {
  return `WD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function requestWithdrawal({ type, schoolId, amount, accountNumber, bankCode, accountName, gateway, requestedBy }) {
  const revenue = type === 'school'
    ? await getSchoolRevenue(schoolId)
    : await getPlatformRevenue();
  const available = type === 'school' ? revenue.netRevenue : revenue.totalPlatformFees;

  if (amount > available) {
    throw new Error(`Requested amount exceeds available ${type} revenue (₦${available.toLocaleString()})`);
  }

  const withdrawal = await Withdrawal.create({
    type, schoolId: schoolId || null, amount, accountNumber, bankCode, accountName,
    gateway, requestedBy, status: 'processing', reference: generateReference(),
  });

 try {
  let transfer;

  if (gateway === 'paystack') {
    const recipient = await paystackService.createTransferRecipient({ accountNumber, bankCode, accountName });
    transfer = await paystackService.initiateTransfer({
      recipientCode: recipient.recipient_code,
      amount,
      reason: `EduPay ${type} withdrawal`,
      reference: withdrawal.reference,
    });
    withdrawal.status = transfer.status === 'success' ? 'completed' : 'processing';

  } else if (gateway === 'nomba') {
    transfer = await nombaService.initiateTransfer({
      amount,
      destinationAccount: accountNumber,
      destinationBankCode: bankCode,
      narration: `EduPay ${type} withdrawal`,
      reference: withdrawal.reference,
    });
    // NOT YET CONFIRMED: Nomba's actual response field for transfer status.
    // Defaulting to 'processing' rather than guessing 'success' — safer to
    // under-claim completion than mark money as moved when we don't know
    // Nomba's real success indicator yet. Confirm against a real sandbox
    // response before trusting this in production.
    withdrawal.status = 'processing';

  } else {
    throw new Error(`Unsupported gateway: ${gateway}`);
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