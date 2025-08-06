import { Router } from 'express';
import { getFeed, getPublicFeed } from '../controllers/feedController.js'; // Added .js extension
import { requireAuth } from '../middlewares/authMiddleware.js'; // Added .js extension

const router = Router();

router.get('/', requireAuth, getFeed);
router.get('/public', getPublicFeed);

export default router;