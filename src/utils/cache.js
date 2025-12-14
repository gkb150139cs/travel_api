const redis = require('redis');

let redisClient = null;

// Initialize Redis client
const initRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('error', (err) => console.error('Redis Client Error', err));
    redisClient.on('connect', () => console.log('Redis Client Connected'));

    await redisClient.connect();
  } catch (error) {
    console.error('Redis connection failed, using in-memory cache:', error.message);
    redisClient = null;
  }
};

// In-memory cache fallback
const memoryCache = new Map();

const getCache = async (key) => {
  try {
    if (redisClient) {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } else {
      return memoryCache.get(key) || null;
    }
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
};

const setCache = async (key, value, expirySeconds = 300) => {
  try {
    if (redisClient) {
      await redisClient.setEx(key, expirySeconds, JSON.stringify(value));
    } else {
      memoryCache.set(key, value);
      // Simple expiry for memory cache
      setTimeout(() => memoryCache.delete(key), expirySeconds * 1000);
    }
  } catch (error) {
    console.error('Cache set error:', error);
  }
};

const deleteCache = async (key) => {
  try {
    if (redisClient) {
      await redisClient.del(key);
    } else {
      memoryCache.delete(key);
    }
  } catch (error) {
    console.error('Cache delete error:', error);
  }
};

// Cache middleware for GET requests
const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    // Allow bypassing cache with ?nocache=true query parameter
    if (req.query.nocache === 'true') {
      return next();
    }

    const key = `cache:${req.originalUrl}`;
    const cached = await getCache(key);

    if (cached) {
      return res.json(cached);
    }

    // Store original json method
    const originalJson = res.json;
    res.json = function(data) {
      setCache(key, data, duration);
      return originalJson.call(this, data);
    };

    next();
  };
};

module.exports = {
  initRedis,
  getCache,
  setCache,
  deleteCache,
  cacheMiddleware
};

