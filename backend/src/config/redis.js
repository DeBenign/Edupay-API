// src/config/redis.js
const Redis = require('ioredis');
const { env } = require('./env');

let redisClient = null;

const connectRedis = () => {
  try {
    redisClient = new Redis(env.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 5) {
          console.warn('⚠️  Redis unavailable — running without cache/queue');
          return null; // stop retrying
        }
        return Math.min(times * 500, 3000);
      },
      lazyConnect: true,
    });

    redisClient.on('connect',      () => console.log('✅ Redis connected'));
    redisClient.on('error',        (e) => console.warn('⚠️  Redis error:', e.message));
    redisClient.on('close',        () => console.warn('⚠️  Redis closed'));

    redisClient.connect().catch(() => {
      console.warn('⚠️  Redis not available — app will run without it');
    });

    return redisClient;
  } catch (err) {
    console.warn('⚠️  Redis init failed — continuing without Redis:', err.message);
    return null;
  }
};

const getRedisClient = () => redisClient;

const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    console.log('🔌 Redis connection closed');
  }
};

module.exports = { connectRedis, getRedisClient, disconnectRedis };
