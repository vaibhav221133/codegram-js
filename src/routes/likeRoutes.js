import { Router } from 'express';
import { toggleLike, checkLike, getUserLikes } from '../controllers/likeController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/', requireAuth, toggleLike);
router.get('/check', requireAuth, checkLike);
router.get('/user/:userId', getUserLikes);

export default router;
