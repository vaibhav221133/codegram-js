import { logger } from '../utils/logger.js'; // Added .js extension
import { Prisma } from '@prisma/client'; // Keep this import for Prisma error types even in JS
import { ZodError } from 'zod';

export const errorHandler = (error, req, res, next) => { // Removed type annotations
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return res.status(409).json({ 
          error: 'Resource already exists',
          field: error.meta?.target 
        });
      case 'P2025':
        return res.status(404).json({ error: 'Resource not found' });
      default:
        return res.status(400).json({ error: 'Database operation failed' });
    }
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }))
    });
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Default error
  const statusCode = error.statusCode || error.status || 500;
  res.status(statusCode).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message 
  });
};