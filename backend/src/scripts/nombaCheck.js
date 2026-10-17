// scripts/nombaCheck.js
require('dotenv').config();
const axios = require('axios');

(async () => {
  console.log('NOMBA_BASE_URL:', process.env.NOMBA_BASE_URL);
  console.log('Client ID starts:', (process.env.NOMBA_CLIENT_ID || '').slice(0, 6));
  for (const host of ['https://api.nomba.com', 'https://sandbox.nomba.com']) {
    try {
      const r = await axios.post(`${host}/v1/auth/token/issue`, {
        grant_type: 'client_credentials',
        client_id: process.env.NOMBA_CLIENT_ID,
        client_secret: process.env.NOMBA_SECRET_KEY,
      }, { headers: { accountId: process.env.NOMBA_ACCOUNT_ID, 'Content-Type': 'application/json' }, timeout: 15000 });
      console.log(host, '→ OK');
    } catch (e) {
      console.log(host, '→ FAIL', e.response?.status, JSON.stringify(e.response?.data));
    }
  }
})();