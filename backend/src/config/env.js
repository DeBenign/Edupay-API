// src/config/env.js
const requiredEnvVars = [
  'MONGO_URI',
  'REDIS_URL',
  'JWT_SECRET',
  'NOMBA_BASE_URL',
  'NOMBA_CLIENT_ID',
  'NOMBA_SECRET_KEY',
  'NOMBA_ACCOUNT_ID',
  'NOMBA_SUB_ACCOUNT_ID',
  'NOMBA_WEBHOOK_SECRET',
];

const validateEnv = () => {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((key) => console.error(`   - ${key}`));
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
      // No /v1 suffix — version is added per-request in nomba.js
      baseUrl:       process.env.NOMBA_BASE_URL,
      clientId:      process.env.NOMBA_CLIENT_ID,
      secretKey:     process.env.NOMBA_SECRET_KEY,
      accountId:     process.env.NOMBA_ACCOUNT_ID,
      subAccountId:  process.env.NOMBA_SUB_ACCOUNT_ID,
      webhookSecret: process.env.NOMBA_WEBHOOK_SECRET,
    },
    // Optional second gateway, run in parallel with Nomba. Deliberately NOT
    // added to requiredEnvVars — the app must keep working for schools still
    // fully on Nomba even if these are unset.
    paystack: {
      secretKey:     process.env.PAYSTACK_SECRET_KEY     || null,
      webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY || null,
      // Set to 'test-bank' in your test-mode env to pilot-test DVA creation
      // and reconciliation without touching a real bank. Leave unset in
      // production — defaults to 'wema-bank'.
      preferredBank: process.env.PAYSTACK_PREFERRED_BANK || null,
    },
    // Which gateway new students are provisioned on by default.
    // Switch this to 'paystack' once the pilot school is validated.
    defaultPaymentGateway: process.env.DEFAULT_PAYMENT_GATEWAY || 'nomba',

    // Airtime/VTU provider for referral rewards (task 2ii) — pick a provider
    // (VTpass, Reloadly, etc.) and set both of these; unset = disabled.
    airtime: {
      baseUrl: process.env.AIRTIME_PROVIDER_BASE_URL || null,
      apiKey:  process.env.AIRTIME_PROVIDER_API_KEY  || null,
    },
  },
};