import rateLimit from 'express-rate-limit';
// Removed Request, Response, NextFunction types
import { env } from '../config/environment.js'; // Added .js extension
import { logger } from '../utils/logger.js'; // Added .js extension

// Custom handler to log limit reached (can be reused)
const logLimitReached = (context) => { // Removed type annotation
  return (req, res, next) => { // Removed type annotations
    logger.warn(`${context} rate limit reached`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id, // Removed type assertion
    });
    res.status(429).json({ message: 'Too many requests, please try again later.' });
  };
};

// Auth limiter
export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 50,
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: logLimitReached('Auth'),
});

// Upload limiter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: 'Upload limit exceeded, please try again later.',
  handler: logLimitReached('Upload'),
});

// API limiter
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
});

// Per-user content creation limiter
export const createContentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  keyGenerator: (req) => {
    const user = req.user; // Removed type assertion
    if (user && user.id) {
      return `user:${user.id}`;
    }
    return req.ip || 'unknown';
  },
  message: 'Content creation limit exceeded, please try again later.',
  handler: logLimitReached('Content creation'),
});

// Content Security Policy enhancement
export const enhancedCSP = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      scriptSrc: ["'self'", 'https://cdn.redoc.ly'],
      connectSrc: ["'self'", 'wss:', 'ws:'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
};

// Input sanitization middleware
export const sanitizeInput = (req, res, next) => { // Removed type annotations
  const sanitize = (obj) => { // Removed type annotations
    if (typeof obj === 'string') {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        obj[key] = sanitize(obj[key]);
      }
    }
    return obj;
  };

  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);

  next();
};

// Pagination validation middleware
export const validatePagination = (req, res, next) => { // Removed type annotations
  const page = parseInt(req.query.page) || 1; // Removed type assertion
  const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Removed type assertion

  if (page < 1) {
    return res.status(400).json({ error: 'Page must be greater than 0' });
  }

  if (limit < 1 || limit > 50) {
    return res.status(400).json({ error: 'Limit must be between 1 and 50' });
  }

  req.query.page = page.toString();
  req.query.limit = limit.toString();

  next();
};