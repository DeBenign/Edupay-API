// src/config/redis.js
const Redis = require('ioredis');
const { env } = require('./env');

let redisClient = null;

const connectRedis = () => {
  redisClient = new Redis(env.redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (times > 10) {
        console.error('❌ Redis max retries reached');
        return null;
      }
      const delay = Math.min(times * 500, 3000);
      console.log(`🔄 Redis reconnecting in ${delay}ms...`);
      return delay;
    },
  });

  redisClient.on('connect', () => console.log('✅ Redis connected'));
  redisClient.on('error', (err) => console.error('❌ Redis error:', err.message));
  redisClient.on('close', () => console.warn('⚠️  Redis connection closed'));

  return redisClient;
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    console.log('🔌 Redis connection closed');
  }
};

module.exports = { connectRedis, getRedisClient, disconnectRedis };
