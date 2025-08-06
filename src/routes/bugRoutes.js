import { Router } from 'express';
import { 
    getAllBugs, 
    getBugById, 
    createBug, 
    updateBugStatus, 
    deleteBug,
    addBugView,
    getBugViews
} from '../controllers/bugController.js'; // Added .js extension
import { requireAuth } from '../middlewares/authMiddleware.js'; // Added .js extension

const router = Router();

router.get('/', getAllBugs);
router.get('/:id', getBugById);
router.post('/', requireAuth, createBug);
router.patch('/:id/status', requireAuth, updateBugStatus);
router.delete('/:id', requireAuth, deleteBug);

// Routes for bug views
router.post('/:bugId/view', requireAuth, addBugView);
router.get('/:bugId/views', requireAuth, getBugViews);


export default router;