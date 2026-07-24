// src/config/paystack.js
// Mirrors config/nomba.js so the rest of the codebase stays consistent.
// Paystack auth is simpler than Nomba's — a static secret key as a Bearer token,
// no token issuance/refresh step required.

const axios = require('axios');
const { env } = require('./env');

const BASE_URL = 'https://api.paystack.co';

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${env.paystack.secretKey}`,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// ─── Universal Paystack request wrapper ───────────────────────────────────────
const paystackRequest = async (method, endpoint, data = null, params = null) => {
  try {
    const response = await client({ method, url: endpoint, data, params });
    return response.data;
  } catch (error) {
    console.error(`❌ Paystack API error [${method.toUpperCase()} ${endpoint}]`, {
      status: error.response?.status,
      data:   error.response?.data,
      sentParams: params,
    });
    const msg = error.response?.data?.message || error.message;
    throw new Error(`Paystack API error: ${msg}`);
  }
};

module.exports = { paystackRequest };