// src/config/nomba.js

const axios = require('axios');
const { env } = require('./env');

let accessToken    = null;
let tokenExpiresAt = null;

// ─── Fetch Nomba access token ─────────────────────────────────────────────────
const fetchNombaToken = async () => {
  try {
    const response = await axios.post(
      `${env.nomba.baseUrl}/v1/auth/token/issue`,
      {
        clientId:     env.nomba.clientId,
        clientSecret: env.nomba.secretKey,   // secretKey used as clientSecret in body
        grant_type:   'client_credentials',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          accountId:      env.nomba.accountId, // parent account ID in header
        },
        timeout: 15000,
      }
    );

    const payload      = response.data?.data || response.data;
    accessToken        = payload.access_token;
    tokenExpiresAt     = Date.now() + ((payload.expires_in || 3600) - 60) * 1000;

    console.log('✅ Nomba access token refreshed');
    return accessToken;
  } catch (error) {
    const errData = error.response?.data || error.message;
    console.error('❌ Failed to fetch Nomba token:', errData);
    throw new Error('Nomba authentication failed');
  }
};

// ─── Get valid token (auto-refresh when expired) ──────────────────────────────
const getNombaToken = async () => {
  if (!accessToken || Date.now() >= tokenExpiresAt) {
    await fetchNombaToken();
  }
  return accessToken;
};

// ─── Axios client factory ─────────────────────────────────────────────────────
// version: 'v1' for most endpoints, 'v2' for transfers
const makeClient = (token, version = 'v1') =>
  axios.create({
    baseURL: `${env.nomba.baseUrl}/${version}`,
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      accountId:      env.nomba.accountId,
    },
    timeout: 15000,
  });

// ─── Universal Nomba request wrapper ──────────────────────────────────────────
const nombaRequest = async (method, endpoint, data = null, params = null, version = 'v1') => {
  try {
    const token    = await getNombaToken();
    const response = await makeClient(token, version)({ method, url: endpoint, data, params });
    return response.data;
  } catch (error) {
    // Force token refresh on 401 and retry once
    if (error.response?.status === 401) {
      console.warn('⚠️  Nomba 401 — force-refreshing token and retrying...');
      accessToken    = null;
      tokenExpiresAt = null;
      const token    = await getNombaToken();
      const response = await makeClient(token, version)({ method, url: endpoint, data, params });
      return response.data;
    }
    const msg = error.response?.data?.description
             || error.response?.data?.message
             || error.message;
    console.error(`❌ Nomba API error [${method.toUpperCase()} ${endpoint}]:`, msg);
    throw new Error(`Nomba API error: ${msg}`);
  }
};

module.exports = { nombaRequest, getNombaToken };
