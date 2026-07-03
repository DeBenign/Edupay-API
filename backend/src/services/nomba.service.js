// src/services/nomba.service.js
// Single source of truth for every Nomba API call.
// All other services call through here — nothing calls nombaRequest directly.

const { nombaRequest } = require('../config/nomba');
const { env } = require('../config/env');

// ─── VIRTUAL ACCOUNTS ─────────────────────────────────────────────────────────

/**
 * Provision a new virtual account for a student.
 * Each student gets a unique dedicated account number parents can save permanently.
 *
 * @param {object} params
 * @param {string} params.accountName   - Display name on the account e.g. "Ade Johnson - School Fees"
 * @param {string} params.reference     - Your internal unique reference (student's _id)
 * @param {string} [params.bvn]         - Optional BVN for KYC-verified accounts
 * @returns {object} Nomba virtual account data
 */
const createVirtualAccount = async ({ accountName, reference, bvn }) => {
  const payload = {
    accountName,
    reference,
    ...(bvn && { bvn }),
  };

  const response = await nombaRequest('post', '/accounts/virtual', payload);
  return response.data;
};

/**
 * Fetch details of a specific virtual account by its account number.
 *
 * @param {string} accountNumber
 * @returns {object} Virtual account details
 */
const getVirtualAccount = async (accountNumber) => {
  const response = await nombaRequest('get', `/accounts/virtual/${accountNumber}`);
  return response.data;
};

/**
 * List all virtual accounts under the main Nomba account.
 * Useful for reconciliation audits.
 *
 * @param {object} params - Optional filters: page, limit
 * @returns {object} Paginated list of virtual accounts
 */
const listVirtualAccounts = async (params = {}) => {
  const response = await nombaRequest('get', '/accounts/virtual', null, {
    page: params.page || 1,
    limit: params.limit || 50,
  });
  return response.data;
};

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

/**
 * Fetch transactions for a specific virtual account.
 * Used by the cron sync job as a safety net for missed webhooks.
 *
 * @param {object} params
 * @param {string} params.accountNumber - Virtual account number to query
 * @param {string} [params.from]        - ISO date string: start of range
 * @param {string} [params.to]          - ISO date string: end of range
 * @param {number} [params.page]
 * @param {number} [params.limit]
 * @returns {object} Paginated transaction list
 */
const getAccountTransactions = async ({ accountNumber, from, to, page = 1, limit = 50 }) => {
  const response = await nombaRequest(
    'get',
    `/accounts/virtual/${accountNumber}/transactions`,
    null,
    {
      ...(from && { from }),
      ...(to   && { to }),
      page,
      limit,
    }
  );
  return response.data;
};

/**
 * Fetch transactions across ALL virtual accounts under the main account.
 * Used by the hourly sync job to catch any globally missed payments.
 *
 * @param {object} params
 * @param {string} [params.from]  - ISO date string
 * @param {string} [params.to]    - ISO date string
 * @param {number} [params.page]
 * @param {number} [params.limit]
 * @returns {object} Paginated transaction list
 */
const getAllTransactions = async ({ from, to, page = 1, limit = 100 } = {}) => {
  const response = await nombaRequest(
    'get',
    '/transactions',
    null,
    {
      accountId: env.nomba.accountId,
      ...(from && { from }),
      ...(to   && { to }),
      page,
      limit,
    }
  );
  return response.data;
};

/**
 * Fetch a single transaction by its reference.
 * Used to verify a specific payment before recording it.
 *
 * @param {string} reference
 * @returns {object} Transaction details
 */
const getTransactionByReference = async (reference) => {
  const response = await nombaRequest('get', `/transactions/${reference}`);
  return response.data;
};

// ─── TRANSFERS (Outbound) ─────────────────────────────────────────────────────

/**
 * Initiate an outbound transfer — used for refunding overpayments.
 *
 * @param {object} params
 * @param {number} params.amount              - Amount in kobo (NGN × 100)
 * @param {string} params.destinationAccount  - Recipient account number
 * @param {string} params.destinationBankCode - Recipient bank code
 * @param {string} params.narration           - Transfer description
 * @param {string} params.reference           - Your unique transfer reference
 * @returns {object} Transfer result
 */
const initiateTransfer = async ({
  amount,
  destinationAccount,
  destinationBankCode,
  narration,
  reference,
}) => {
  const payload = {
    amount,
    destinationAccount,
    destinationBankCode,
    narration,
    reference,
    currency: 'NGN',
  };

  const response = await nombaRequest('post', '/transfers', payload);
  return response.data;
};

/**
 * Verify the status of an outbound transfer.
 *
 * @param {string} reference - The transfer reference used when initiating
 * @returns {object} Transfer status
 */
const verifyTransfer = async (reference) => {
  const response = await nombaRequest('get', `/transfers/${reference}`);
  return response.data;
};

// ─── BANKS ────────────────────────────────────────────────────────────────────

/**
 * Get the list of supported banks (for transfer/refund bank selection).
 *
 * @returns {Array} List of banks with name and code
 */
const getBankList = async () => {
  const response = await nombaRequest('get', '/transfers/banks');
  return response.data;
};

module.exports = {
  // Virtual accounts
  createVirtualAccount,
  getVirtualAccount,
  listVirtualAccounts,

  // Transactions
  getAccountTransactions,
  getAllTransactions,
  getTransactionByReference,

  // Transfers
  initiateTransfer,
  verifyTransfer,

  // Banks
  getBankList,
};
