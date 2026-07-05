// server.js
require('dotenv').config();
const http = require('http');
const { Server }       = require('socket.io');
const { validateEnv, env } = require('./src/config/env');
const { connectDB }    = require('./src/config/db');
//const { connectRedis } = require('./src/config/redis');
const app              = require('./src/app');

validateEnv();

const server = http.createServer(app);

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: env.clientUrl, credentials: true, methods: ['GET','POST'] },
});
app.locals.io = io;
const { initReconciliationSocket } = require('./src/sockets/reconciliation.socket');
initReconciliationSocket(io);

// ── Boot ──────────────────────────────────────────────────────────────────────
const boot = async () => {
  await connectDB();
 // connectRedis(); // non-fatal if unavailable

  // Start cron jobs
  require('./src/jobs/syncTransactions.job');
  require('./src/jobs/feeReminder.job');

  server.listen(env.port, () => {
    console.log(`\n🚀 EduPay API running on port ${env.port} [${env.nodeEnv}]`);
    console.log(`🏥 Health: http://localhost:${env.port}/health`);
    console.log(`📡 API:    http://localhost:${env.port}/api\n`);
  });
};

boot().catch(err => { console.error('❌ Boot failed:', err); process.exit(1); });

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n⚠️  ${signal} — shutting down...`);
  server.close(async () => {
    const { disconnectDB }    = require('./src/config/db');
    const { disconnectRedis } = require('./src/config/redis');
    await disconnectDB();
    await disconnectRedis();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM',           () => shutdown('SIGTERM'));
process.on('SIGINT',            () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => { console.error('❌ Uncaught:', err); shutdown('uncaughtException'); });
process.on('unhandledRejection',(r)  => { console.error('❌ Rejection:', r);  shutdown('unhandledRejection'); });
