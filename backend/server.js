// server.js
require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const { validateEnv, env } = require('./src/config/env');
const { connectDB } = require('./src/config/db');
//const { connectRedis } = require('./src/config/redis');
const app = require('./src/app');

// ─── Validate environment variables first ──────────────────────────────────
validateEnv();

// ─── Create HTTP server ────────────────────────────────────────────────────
const server = http.createServer(app);

// ─── Socket.io setup ───────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: env.clientUrl,
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

// Make io accessible across the app via app.locals
app.locals.io = io;

// Import and initialize socket handlers
const { initReconciliationSocket } = require('./src/sockets/reconciliation.socket');
initReconciliationSocket(io);

// ─── Boot sequence ─────────────────────────────────────────────────────────
const boot = async () => {
  try {
    await connectDB();
   // connectRedis();

    // Start cron jobs after DB and Redis are ready
    require('./src/jobs/syncTransactions.job');
    require('./src/jobs/feeReminder.job');

    server.listen(env.port, () => {
      console.log(`\n🚀 Server running on port ${env.port} [${env.nodeEnv}]`);
      console.log(`📡 WebSocket server ready`);
      console.log(`🏥 Health check: http://localhost:${env.port}/health\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

boot();

// ─── Graceful shutdown ─────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n⚠️  ${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    const { disconnectDB } = require('./src/config/db');
    const { disconnectRedis } = require('./src/config/redis');
    await disconnectDB();
    await disconnectRedis();
    console.log('✅ Server shut down cleanly');
    process.exit(0);
  });

  // Force exit after 10s if graceful shutdown fails
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  (err) => {
  console.error('❌ Uncaught Exception:', err);
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  shutdown('unhandledRejection');
});
