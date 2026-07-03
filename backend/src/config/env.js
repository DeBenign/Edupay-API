// src/config/env.js
const requiredEnvVars = [
  'MONGO_URI',
  'REDIS_URL',
  'JWT_SECRET',
  'NOMBA_BASE_URL',
  'NOMBA_CLIENT_ID',
  'NOMBA_SECRET_KEY',
  'NOMBA_ACCOUNT_ID',
  'NOMBA_SUB_ACCOUNT_ID',   // ← ADD THIS (was missing in original)
  'NOMBA_WEBHOOK_SECRET',
];

const validateEnv = () => {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error('\n📋 Copy .env.example to .env and fill in the values.');
    process.exit(1);
  }
  console.log('✅ Environment variables validated');
};

module.exports = {
  validateEnv,
  env: {
    nodeEnv:   process.env.NODE_ENV    || 'development',
    port:      parseInt(process.env.PORT, 10) || 5000,
    clientUrl: process.env.CLIENT_URL  || 'http://localhost:5173',

    mongoUri:  process.env.MONGO_URI,
    redisUrl:  process.env.REDIS_URL,

    jwt: {
      secret:    process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },

    nomba: {
      baseUrl:       process.env.NOMBA_BASE_URL,
      clientId:      process.env.NOMBA_CLIENT_ID,
      secretKey:     process.env.NOMBA_SECRET_KEY,
      accountId:     process.env.NOMBA_ACCOUNT_ID,
      subAccountId:  process.env.NOMBA_SUB_ACCOUNT_ID,  // ← ADD THIS
      webhookSecret: process.env.NOMBA_WEBHOOK_SECRET,
    },
  },
};