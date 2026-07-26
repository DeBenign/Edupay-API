const axios = require("axios");

const client = axios.create({
  baseURL: process.env.VTPASS_BASE_URL,
  headers: {
    "api-key": process.env.VTPASS_API_KEY,
    "secret-key": process.env.VTPASS_SECRET_KEY,
  },
});

const NETWORK_SERVICE_ID = { mtn: "mtn", glo: "glo", airtel: "airtel", "9mobile": "etisalat" };

async function buyAirtime({ phoneNumber, network, amount }) {
  const requestId = `EDUPAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const { data } = await client.post("/pay", {
    request_id: requestId,
    serviceID: NETWORK_SERVICE_ID[network],
    amount,
    phone: phoneNumber,
  });
  return { requestId, raw: data };
}

async function verifyTransaction(requestId) {
  const { data } = await client.post("/requery", { request_id: requestId });
  return data; // data.content.transactions.status === "delivered"
}

module.exports = { buyAirtime, verifyTransaction };