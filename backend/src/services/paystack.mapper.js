// src/services/paystack.mapper.js
// Mirrors nomba.mapper.js's shape exactly, so Student.virtualAccount looks
// identical regardless of which gateway provisioned it.

const normalizePaystackAccount = (dva) => ({
  accountNumber:   dva.account_number,
  accountName:     dva.account_name,
  bankName:        dva.bank?.name || null,
  bankCode:        dva.bank?.slug || null,

  accountRef:      dva.customer?.customer_code || dva.customer_code || null,
  accountHolderId: dva.id ? String(dva.id) : null,

  provisionedAt:   new Date(dva.createdAt || dva.created_at || Date.now()),

  gateway:         'paystack',
});

module.exports = {
  normalizePaystackAccount,
};