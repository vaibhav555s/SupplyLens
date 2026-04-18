// ─── Redis Cache with In-Memory Fallback ───
// If Redis is unavailable, falls back to a Map-based cache with TTL support.

const config = require('../config');

let redisClient = null;
let useInMemory = false;
const memoryCache = new Map();

// ─── Try to connect to Redis ───
async function initRedis() {
    if (redisClient) return redisClient;

    try {
        const Redis = require('ioredis');
        redisClient = new Redis(config.redisUrl, {
            maxRetriesPerRequest: 2,
            retryStrategy(times) {
                if (times > 3) {
                    console.warn('[Cache] Redis unavailable — switching to in-memory cache');
                    useInMemory = true;
                    return null; // stop retrying
                }
                return Math.min(times * 200, 2000);
            },
            lazyConnect: true,
        });

        redisClient.on('error', () => {
            if (!useInMemory) {
                console.warn('[Cache] Redis connection error — using in-memory fallback');
                useInMemory = true;
            }
        });

        await redisClient.connect();
        console.log('[Cache] Redis connected');
        return redisClient;
    } catch (err) {
        console.warn('[Cache] Redis unavailable — using in-memory fallback');
        useInMemory = true;
        return null;
    }
}

// ─── In-memory TTL helper ───
function cleanupExpired(key) {
    const entry = memoryCache.get(key);
    if (entry && entry.expiresAt && Date.now() > entry.expiresAt) {
        memoryCache.delete(key);
        return true;
    }
    return false;
}

// ─── Public API ───

/**
 * Get a cached value by key.
 * @param {string} key
 * @returns {Promise<any|null>}
 */
async function cacheGet(key) {
    if (!useInMemory && redisClient) {
        try {
            const val = await redisClient.get(key);
            return val ? JSON.parse(val) : null;
        } catch {
            // fallthrough to memory
        }
    }

    cleanupExpired(key);
    const entry = memoryCache.get(key);
    return entry ? entry.value : null;
}

/**
 * Set a cached value with TTL.
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds
 */
async function cacheSet(key, value, ttlSeconds) {
    if (!useInMemory && redisClient) {
        try {
            await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
            return;
        } catch {
            // fallthrough to memory
        }
    }

    memoryCache.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
    });
}

/**
 * Check if a key exists in cache.
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function cacheExists(key) {
    if (!useInMemory && redisClient) {
        try {
            return (await redisClient.exists(key)) === 1;
        } catch {
            // fallthrough
        }
    }

    cleanupExpired(key);
    return memoryCache.has(key);
}

/**
 * Build a standardized cache key.
 * @param {string} source - e.g. 'importyeti', 'comtrade'
 * @param  {...string} parts - query parts to hash
 * @returns {string}
 */
function cacheKey(source, ...parts) {
    return `scxray:${source}:${parts.map(p => String(p).toLowerCase().replace(/\s+/g, '_')).join(':')}`;
}

// Auto-init on first require
initRedis().catch(() => { });

module.exports = { cacheGet, cacheSet, cacheExists, cacheKey, initRedis };
