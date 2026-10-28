// backend/api/index.js: Vercel serverless entry for the Express app.
// Socket.io and in-process cron jobs do not run here; see /api/cron/* and vercel.json.
const mongoose = require('mongoose');
const app = require('../src/app');

let connecting = null; // reused across warm invocations
const connect = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!connecting) {
    connecting = mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, maxPoolSize: 5 })
      .catch((err) => { connecting = null; throw err; });
  }
  return connecting;
};

module.exports = async (req, res) => {
  const missing = ['MONGO_URI', 'JWT_SECRET'].filter((k) => !process.env[k]);
  if (missing.length) return res.status(500).json({ success: false, message: `Missing env: ${missing.join(', ')}` });
  try { await connect(); }
  catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }
  return app(req, res);
};
