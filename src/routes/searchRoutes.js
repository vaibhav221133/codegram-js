import { Router } from 'express';
import { searchAll, getTrending, getTags } from '../controllers/searchController.js';

const router = Router();

router.get('/', searchAll);
router.get('/trending', getTrending);
router.get('/tags', getTags);

export default router;