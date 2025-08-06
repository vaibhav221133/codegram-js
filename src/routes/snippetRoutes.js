import { Router } from 'express';
import { getAllSnippets, getSnippetById, createSnippet, updateSnippet, deleteSnippet } from '../controllers/snippetController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', getAllSnippets);
router.get('/:id', getSnippetById);
router.post('/', requireAuth, createSnippet);
router.put('/:id', requireAuth, updateSnippet);
router.delete('/:id', requireAuth, deleteSnippet);

export default router;