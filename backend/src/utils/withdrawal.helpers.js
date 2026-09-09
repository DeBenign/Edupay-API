// utils/withdrawal.helpers.js — new, tiny file
const withdrawalStatusMessage = (status) => ({
  completed: 'Withdrawal completed',
  processing: 'Withdrawal initiated — awaiting gateway confirmation',
  failed: 'Withdrawal failed',
}[status] || 'Withdrawal status unknown');

module.exports = { withdrawalStatusMessage };