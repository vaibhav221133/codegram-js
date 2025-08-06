import { Router } from 'express';
import { getNotifications, markAsRead, getUnreadCount } from '../controllers/notificationController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', requireAuth, getNotifications);
router.post('/read', requireAuth, markAsRead);
router.get('/unread-count', requireAuth, getUnreadCount);

export default router;
