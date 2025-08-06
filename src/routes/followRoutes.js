import { Router } from 'express';
import { toggleFollow, checkFollow, getFollowers, getFollowing, getSuggestedUsers } from '../controllers/followController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/suggestions', requireAuth, getSuggestedUsers);
router.post('/:userId', requireAuth, toggleFollow);
router.get('/check/:userId', requireAuth, checkFollow);
router.get('/:userId/followers', getFollowers);
router.get('/:userId/following', getFollowing);


export default router;