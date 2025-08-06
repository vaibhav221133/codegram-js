// src/routes/uploadRoutes.js
import { Router } from 'express';
import { upload, uploadFiles, deleteFile } from '../controllers/uploadController.js'; // Ensure .js extension
import { requireAuth } from '../middlewares/authMiddleware.js'; // Ensure .js extension

const router = Router();

// Upload files (profile pictures or media)
router.post('/:type', requireAuth, upload.array('files', 5), uploadFiles);

// Delete file: now accepts publicId instead of filename
// The 'type' parameter will be used by deleteFile to determine Cloudinary resource_type
router.delete('/:type/:publicId', requireAuth, deleteFile); // Changed ':filename' to ':publicId'

export default router;