import { z } from 'zod';
import { logger } from '../utils/logger.js'; // Added .js extension

export const requireAuth = (req, res, next) => { // Removed type annotations
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};

// Role-based access control middleware
export const requireRole = (roles) => { // Removed type annotation
    return (req, res, next) => { // Removed type annotations
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const user = req.user; // Removed type assertion
        if (!roles.includes(user.role)) {
            logger.warn('Unauthorized role access attempt:', {
                userId: user.id,
                userRole: user.role,
                requiredRoles: roles,
                endpoint: req.path,
            });
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};

// Admin-only middleware
export const requireAdmin = requireRole(['ADMIN']);

// Input validation middleware factory
export const validateInput = (schema) => { // Removed type annotation
    return (req, res, next) => { // Removed type annotations
        try {
            const validationResult = schema.safeParse({
                body: req.body,
                query: req.query,
                params: req.params,
            });

            if (!validationResult.success) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationResult.error.errors.map(err => ({
                        field: err.path.join('.'),
                        message: err.message,
                    })),
                });
            }

            // Replace request data with validated data
            req.body = validationResult.data.body || req.body;
            req.query = validationResult.data.query || req.query;
            req.params = validationResult.data.params || req.params;

            next();
        } catch (error) {
            logger.error('Input validation error:', error);
            res.status(500).json({ error: 'Validation error' });
        }
    };
}