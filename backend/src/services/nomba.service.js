// src/services/nomba.service.js
// All endpoints verified from official Nomba Slack channel.
// subAccountId goes in PATH for VA and transaction endpoints.
// Transfers use /v2/, everything else /v1/.

const { nombaRequest } = require('../config/nomba');
const { env }          = require('../config/env');

// ─── VIRTUAL ACCOUNTS ────────────────────────────────────────────────────────

// POST /v1/accounts/virtual/{subAccountId}
const createVirtualAccount = async ({ accountName, reference, bvn }) => {
  const sub      = env.nomba.subAccountId;
  const payload  = { accountName, reference, ...(bvn && { bvn }) };
  const response = await nombaRequest('post', `/accounts/virtual/${sub}`, payload);
  return response.data;
};

// POST /v1/accounts/virtual/list
const listVirtualAccounts = async (params = {}) => {
  const response = await nombaRequest('post', '/accounts/virtual/list', {
    subAccountId: env.nomba.subAccountId,
    ...params,
  });
  return response.data;
};

// GET /v1/accounts/virtual/{identifier}
const getVirtualAccount = async (identifier) => {
  const response = await nombaRequest('get', `/accounts/virtual/${identifier}`);
  return response.data;
};

// DELETE /v1/accounts/virtual/{identifier}
const deleteVirtualAccount = async (identifier) => {
  const response = await nombaRequest('delete', `/accounts/virtual/${identifier}`);
  return response.data;
};

// GET /v1/accounts/{subAccountId}/balance
const getSubAccountBalance = async () => {
  const sub      = env.nomba.subAccountId;
  const response = await nombaRequest('get', `/accounts/${sub}/balance`);
  return response.data;
};

// ─── TRANSACTIONS ────────────────────────────────────────────────────────────

// GET /v1/transactions/accounts/{subAccountId}
// Used by hourly cron sync job — fetches all inflows for reconciliation
const getAllTransactions = async ({ from, to, page = 1, limit = 100 } = {}) => {
  const sub      = env.nomba.subAccountId;
  const response = await nombaRequest(
    'get',
    `/transactions/accounts/${sub}`,
    null,
    { ...(from && { from }), ...(to && { to }), page, limit }
  );
  return response.data;
};

// POST /v1/transactions/accounts/{subAccountId} — filter with body
const filterTransactions = async (filters = {}) => {
  const sub      = env.nomba.subAccountId;
  const response = await nombaRequest('post', `/transactions/accounts/${sub}`, filters);
  return response.data;
};

// GET /v1/transactions/requery/{sessionId}
const requeueTransaction = async (sessionId) => {
  const response = await nombaRequest('get', `/transactions/requery/${sessionId}`);
  return response.data;
};

// ─── TRANSFERS (v2) ──────────────────────────────────────────────────────────

// POST /v2/transfers/bank/{subAccountId}
const initiateTransfer = async ({ amount, destinationAccount, destinationBankCode, narration, reference }) => {
  const sub      = env.nomba.subAccountId;
  const response = await nombaRequest(
    'post',
    `/transfers/bank/${sub}`,
    { amount, destinationAccount, destinationBankCode, narration, reference, currency: 'NGN' },
    null,
    'v2'
  );
  return response.data;
};

// POST /v1/transfers/bank/lookup
const lookupBankAccount = async ({ accountNumber, bankCode }) => {
  const response = await nombaRequest('post', '/transfers/bank/lookup', { accountNumber, bankCode });
  return response.data;
};

// GET /v1/transfers/banks
const getBankList = async () => {
  const response = await nombaRequest('get', '/transfers/banks');
  return response.data;
};

// POST /v2/transfers/wallet/{subAccountId}
const walletTransfer = async ({ amount, destinationAccountId, narration, reference }) => {
  const sub      = env.nomba.subAccountId;
  const response = await nombaRequest(
    'post',
    `/transfers/wallet/${sub}`,
    { amount, destinationAccountId, narration, reference },
    null,
    'v2'
  );
  return response.data;
};

// GET /v1/transactions/requery/{sessionId} — confirm a specific txn
const verifyTransfer = async (sessionId) => {
  return requeueTransaction(sessionId);
};

module.exports = {
  createVirtualAccount,
  listVirtualAccounts,
  getVirtualAccount,
  deleteVirtualAccount,
  getSubAccountBalance,
  getAllTransactions,
  filterTransactions,
  requeueTransaction,
  initiateTransfer,
  lookupBankAccount,
  getBankList,
  walletTransfer,
  verifyTransfer,
};
