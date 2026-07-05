// src/config/db.js
const mongoose = require('mongoose');
const { env }  = require('./env');

const connectDB = async (retries = 5) => {
  try {
    const conn = await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
    mongoose.connection.on('error', (err) => console.error('❌ MongoDB error:', err.message));
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    if (retries > 0) {
      console.log(`🔄 Retrying in 5s... (${retries} left)`);
      await new Promise(r => setTimeout(r, 5000));
      return connectDB(retries - 1);
    }
    process.exit(1);
  }
};

const disconnectDB = async () => {
  await mongoose.connection.close();
  console.log('🔌 MongoDB connection closed');
};

module.exports = { connectDB, disconnectDB };
