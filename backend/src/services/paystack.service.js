// src/services/paystack.service.js
// Second payment-gateway option, run in parallel with Nomba (see nomba.service.js).
// Same "one virtual account per student" model — Paystack calls it a
// Dedicated Virtual Account (DVA), backed by Titan or Wema Bank.

const { paystackRequest } = require('../config/paystack');
const { normalizePaystackAccount } = require('./paystack.mapper');

// ─── CUSTOMERS ─────────────────────────────────────────────────────────────────
// A DVA in Paystack is always attached to a customer record first.
const createOrFetchCustomer = async ({ email, firstName, lastName, phone }) => {
  // Paystack's Create Customer endpoint is idempotent on email — calling it
  // again for an existing email updates and returns that same customer,
  // it does not error. This gives us the same "already exists" safety that
  // the Nomba path handles with a catch block.
  const response = await paystackRequest('post', '/customer', {
    email,
    first_name: firstName,
    last_name:  lastName,
    phone,
  });
  return response.data; // { customer_code, id, ... }
};

// ─── PROVIDERS ──────────────────────────────────────────────────────────────────
// GET /dedicated_account/available_providers
const getAvailableProviders = async () => {
  const response = await paystackRequest('get', '/dedicated_account/available_providers');
  return response.data; // [{ provider_slug: 'wema-bank', bank_id, bank_name }, ...]
};

// ─── DEDICATED VIRTUAL ACCOUNTS ─────────────────────────────────────────────────
// POST /dedicated_account
const createDedicatedAccount = async ({ email, firstName, lastName, phone, preferredBank = 'wema-bank' }) => {
  const customer = await createOrFetchCustomer({ email, firstName, lastName, phone });

  const response = await paystackRequest('post', '/dedicated_account', {
    customer:       customer.customer_code,
    preferred_bank: preferredBank,
  });

  const dva = response.data;
  dva.customer = customer; // fold in so the mapper can read customer_code
  return normalizePaystackAccount(dva);
};

// GET /dedicated_account?customer={customer_code}
// Used the same way the Nomba path uses getVirtualAccountByReference — to
// recover an already-provisioned account instead of erroring on retry.
const getDedicatedAccountByCustomer = async (customerCode) => {
  const response = await paystackRequest('get', '/dedicated_account', null, {
    customer: customerCode,
  });
  const records = response.data || [];
  if (!records.length) {
    throw new Error(`No dedicated account found for customer ${customerCode}`);
  }
  const dva = records[0];
  dva.customer = { customer_code: customerCode };
  return normalizePaystackAccount(dva);
};

// GET /dedicated_account/:id
const getDedicatedAccount = async (id) => {
  const response = await paystackRequest('get', `/dedicated_account/${id}`);
  return normalizePaystackAccount(response.data);
};

// ─── TRANSACTIONS (fallback sync path, equivalent to Nomba's getAllTransactions) ─
// GET /transaction?from=&to=&status=success
const listTransactions = async ({ from, to, page = 1, perPage = 100 } = {}) => {
  const response = await paystackRequest('get', '/transaction', null, {
    ...(from && { from }),
    ...(to && { to }),
    status: 'success',
    page,
    perPage,
  });
  return response; // { data: [...], meta: { total, page, ... } }
};

// GET /transaction/verify/:reference — direct verification of one transaction,
// the Paystack equivalent of Nomba's requery endpoint.
const verifyTransaction = async (reference) => {
  const response = await paystackRequest('get', `/transaction/verify/${reference}`);
  return response.data;
};

// ─── PAYOUTS (task 3 — withdrawing revenue to a real bank account) ─────────────
// POST /transferrecipient
const createTransferRecipient = async ({ accountNumber, bankCode, accountName }) => {
  const response = await paystackRequest('post', '/transferrecipient', {
    type: 'nuban',
    name: accountName,
    account_number: accountNumber,
    bank_code: bankCode,
    currency: 'NGN',
  });
  return response.data; // { recipient_code, ... }
};

// POST /transfer
const initiateTransfer = async ({ recipientCode, amount, reason, reference }) => {
  const response = await paystackRequest('post', '/transfer', {
    source: 'balance',
    amount: Math.round(amount * 100), // kobo
    recipient: recipientCode,
    reason,
    reference,
  });
  return response.data;
};

// GET /bank — used to resolve bank codes for the transfer recipient form
const listBanks = async () => {
  const response = await paystackRequest('get', '/bank', null, { country: 'nigeria' });
  return response.data;
};

module.exports = {
  createOrFetchCustomer,
  getAvailableProviders,
  createDedicatedAccount,
  getDedicatedAccountByCustomer,
  getDedicatedAccount,
  listTransactions,
  verifyTransaction,
  createTransferRecipient,
  initiateTransfer,
  listBanks,
};