// src/utils/cache.js
import { logger } from './logger.js'; // Ensure logger is imported

// Removed redisClientInstance as Redis is no longer used for cache
// let redisClientInstance = null;

export class SimpleCache {
  #inMemoryCache = new Map();
  defaultTTL = 5 * 60 * 1000; // Default TTL in milliseconds (5 minutes)

  /**
   * Constructor for SimpleCache. No longer takes a Redis client.
   */
  constructor() {
    logger.warn('SimpleCache initialized using in-memory cache. This is not suitable for production scaling.');
  }

  /**
   * Sets data in the cache. Now only uses in-memory.
   * @param {string} key - The cache key.
   * @param {any} data - The data to store.
   * @param {number} [ttl] - Time to live in milliseconds.
   */
  async set(key, data, ttl) {
    const expiry = ttl || this.defaultTTL;
    this.#inMemoryCache.set(key, { data, expiry: Date.now() + expiry });
  }

  /**
   * Retrieves data from the cache. Now only uses in-memory.
   * @param {string} key - The cache key.
   * @returns {any | null} The cached data or null if not found/expired.
   */
  async get(key) {
    const item = this.#inMemoryCache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.#inMemoryCache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * Deletes data from the cache. Now only uses in-memory.
   * @param {string} key - The cache key to delete.
   */
  async delete(key) {
    this.#inMemoryCache.delete(key);
  }

  /**
   * Clears all data from the cache. Now only uses in-memory.
   */
  async clear() {
    this.#inMemoryCache.clear();
  }

  // This cleanup is for the in-memory cache.
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.#inMemoryCache.entries()) {
      if (now > item.expiry) {
        this.#inMemoryCache.delete(key);
      }
    }
  }
}

export const cache = new SimpleCache(); // This will now always be an in-memory cache

// Keep the interval for periodic cleanup of the in-memory cache.
setInterval(() => cache.cleanup(), 10 * 60 * 1000);