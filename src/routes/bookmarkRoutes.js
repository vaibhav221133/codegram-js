import { Router } from 'express';
import { toggleBookmark, checkBookmark, getUserBookmarks } from '../controllers/bookmarkController.js'; // Added .js extension
import { requireAuth } from '../middlewares/authMiddleware.js'; // Added .js extension

const router = Router();

router.post('/', requireAuth, toggleBookmark);
router.get('/check', requireAuth, checkBookmark);
router.get('/user/:userId', getUserBookmarks);

export default router;