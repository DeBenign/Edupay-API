// src/config/db.js
const mongoose = require('mongoose');
const { env } = require('./env');

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

const connectDB = async (retries = MAX_RETRIES) => {
  try {
    const conn = await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);

    if (retries > 0) {
      console.log(`🔄 Retrying in ${RETRY_DELAY_MS / 1000}s... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return connectDB(retries - 1);
    }

    console.error('❌ Max retries reached. Exiting.');
    process.exit(1);
  }
};

const disconnectDB = async () => {
  await mongoose.connection.close();
  console.log('🔌 MongoDB connection closed');
};

module.exports = { connectDB, disconnectDB };
