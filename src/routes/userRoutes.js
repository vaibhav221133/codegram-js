import { Router } from 'express';
import { getUserProfile, getUserContent } from '../controllers/userController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = Router();

// Get user profile by username
router.get('/:username', getUserProfile);

// Get user's content (snippets, docs, bugs)
router.get('/:username/content', getUserContent);

export default router;