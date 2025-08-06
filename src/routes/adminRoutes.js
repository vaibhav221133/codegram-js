// src/routes/adminRoutes.js
import { Router } from 'express';
import { requireAdmin } from '../middlewares/authMiddleware.js'; // Ensure .js extension
import { getPlatformStats } from '../controllers/adminController.js'; // Ensure .js extension

const router = Router();

// Admin-only route for platform statistics
router.get('/stats', requireAdmin, getPlatformStats);

export default router;