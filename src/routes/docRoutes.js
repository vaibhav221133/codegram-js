import { Router } from 'express';
import { getAllDocs, getDocById, createDoc, updateDoc, deleteDoc } from '../controllers/docController.js'; // Added .js extension
import { requireAuth } from '../middlewares/authMiddleware.js'; // Added .js extension

const router = Router();

router.get('/', getAllDocs);
router.get('/:id', getDocById);
router.post('/', requireAuth, createDoc);
router.put('/:id', requireAuth, updateDoc);
router.delete('/:id', requireAuth, deleteDoc);

export default router;