import { Router } from 'express';
import {
  getPreferences,
  updatePreferences,
  updateProfile, // This is the controller function we're targeting
  deleteAccount,
  getDashboardStats,
} from '../controllers/settingsController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { upload } from '../controllers/uploadController.js'; // Import the Multer upload instance

const router = Router();

router.get('/preferences', requireAuth, getPreferences);
router.patch('/preferences', requireAuth, updatePreferences);

// Apply multer middleware to handle avatar upload for the profile update route
// 'avatar' is the name of the field in the multipart/form-data that contains the file
// The ':type' parameter is set to 'profile' for multer's destination logic in uploadController.js
router.patch('/profile', requireAuth, upload.single('avatar'), updateProfile);

router.delete('/account', requireAuth, deleteAccount);
router.get('/dashboard', requireAuth, getDashboardStats);

export default router;