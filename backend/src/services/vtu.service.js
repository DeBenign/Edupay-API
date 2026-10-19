// src/services/vtu.service.js
const axios = require('axios');

const NETWORKS = ['mtn', 'glo', 'airtel', '9mobile'];
const AIRTIME_SERVICE = { mtn: 'mtn', glo: 'glo', airtel: 'airtel', '9mobile': 'etisalat' };
const DATA_SERVICE    = { mtn: 'mtn-data', glo: 'glo-data', airtel: 'airtel-data', '9mobile': 'etisalat-data' };

const client = axios.create({ timeout: 20000 });
const base = () => process.env.VTPASS_BASE_URL; // include the /api part, from your VTpass dashboard docs

// VTpass: POST calls use api-key + secret-key; GET calls use api-key + public-key
const postHeaders = () => ({ 'api-key': process.env.VTPASS_API_KEY, 'secret-key': process.env.VTPASS_SECRET_KEY });
const getHeaders  = () => ({ 'api-key': process.env.VTPASS_API_KEY, 'public-key': process.env.VTPASS_PUBLIC_KEY });

// 0803..., +234803..., 234803... -> 0803... (null if invalid)
const normalizePhone = (input) => {
  const digits = String(input || '').replace(/\D/g, '');
  const local = digits.startsWith('234') ? `0${digits.slice(3)}` : digits;
  return /^0[789][01]\d{8}$/.test(local) ? local : null;
};

// delivered | pending | failed
const interpret = (data) => {
  const status = data?.content?.transactions?.status;
  if (status === 'delivered') return 'delivered';
  if (['pending', 'initiated', 'processing'].includes(status) || data?.code === '099') return 'pending';
  return 'failed';
};

const pay = async (payload) => {
  const { data } = await client.post(`${base()}/pay`, payload, { headers: postHeaders() });
  return { requestId: payload.request_id, state: interpret(data), raw: data };
};

const buyAirtime = ({ requestId, phoneNumber, network, amount }) =>
  pay({ request_id: requestId, serviceID: AIRTIME_SERVICE[network], amount, phone: phoneNumber });

const buyData = ({ requestId, phoneNumber, network, variationCode, amount }) =>
  pay({
    request_id: requestId, serviceID: DATA_SERVICE[network],
    billersCode: phoneNumber, variation_code: variationCode, amount, phone: phoneNumber,
  });

const planCache = new Map();
const PLAN_TTL_MS = 10 * 60 * 1000;

// [{ code, name, amount }] sorted by price. Verify the serviceIDs in the VTpass sandbox first.
const getDataPlans = async (network) => {
  const hit = planCache.get(network);
  if (hit && Date.now() - hit.at < PLAN_TTL_MS) return hit.plans;

  const { data } = await client.get(`${base()}/service-variations`, {
    params: { serviceID: DATA_SERVICE[network] },
    headers: getHeaders(),
  });
  const list = data?.content?.variations || data?.content?.varations || []; // VTpass has used both spellings
  const plans = list
    .map((v) => ({ code: v.variation_code, name: v.name, amount: Number(v.variation_amount) }))
    .filter((p) => p.code && Number.isFinite(p.amount) && p.amount > 0)
    .sort((a, b) => a.amount - b.amount);

  planCache.set(network, { at: Date.now(), plans });
  return plans;
};

const checkStatus = async (requestId) => {
  const { data } = await client.post(`${base()}/requery`, { request_id: requestId }, { headers: postHeaders() });
  return { state: interpret(data), raw: data };
};

const verifyTransaction = async (requestId) => (await checkStatus(requestId)).raw; // old name, kept for compatibility

module.exports = { NETWORKS, normalizePhone, buyAirtime, buyData, getDataPlans, checkStatus, verifyTransaction };