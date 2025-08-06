// src/controllers/uploadController.js
import multer from 'multer';
import path from 'path';
// Removed fs/promises as local storage won't be used for uploads
// import fs from 'fs/promises';
import { z } from 'zod';
import { v2 as cloudinary } from 'cloudinary'; // Import Cloudinary SDK
import { env } from '../config/environment.js'; // Import env for Cloudinary credentials

// Configure Cloudinary using environment variables
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true // Use HTTPS
});

// Removed local directory variables as we'll upload directly to Cloudinary
// const uploadsDir = 'uploads';
// const profileDir = path.join(uploadsDir, 'profiles');
// const mediaDir = path.join(uploadsDir, 'media');

// Removed ensureDirectories function as local directories won't be created
// async function ensureDirectories() {
//   await fs.mkdir(uploadsDir, { recursive: true });
//   await fs.mkdir(profileDir, { recursive: true });
//   await fs.mkdir(mediaDir, { recursive: true });
// }
// ensureDirectories();


// File validation schema (remains the same)
const fileValidation = z.object({
  mimetype: z.string(),
  size: z.number().max(10 * 1024 * 1024), // 10MB limit
});

// Storage configuration for Multer: Use memoryStorage instead of diskStorage
// Files will be stored in memory as buffers, ready for Cloudinary upload
const storage = multer.memoryStorage();

// File filter (remains mostly the same, removed req:any, file:any, cb:any typings)
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    profile: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    media: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'],
  };

  const uploadType = req.params.type;
  const allowed = allowedTypes[uploadType] || allowedTypes.media;

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // Corrected error message to reflect allowed types for the specific 'type' parameter
    cb(new Error(`Invalid file type for ${uploadType}. Allowed: ${allowed.join(', ')}`), false);
  }
};

export const upload = multer({
  storage, // Use memory storage
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5, // Max 5 files per request
  },
});

export const uploadFiles = async (req, res) => {
  try {
    const { type } = req.params;
    // req.files will be an array of file buffers from multer.memoryStorage()
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = [];
    for (const file of files) {
      // Validate file size using Zod schema
      const validationResult = fileValidation.safeParse({
        mimetype: file.mimetype,
        size: file.size,
      });

      if (!validationResult.success) {
        // If validation fails for a file, return an error
        return res.status(400).json({
          error: `File validation failed for ${file.originalname}`,
          details: validationResult.error.errors,
        });
      }

      // Determine folder in Cloudinary based on type
      const folder = type === 'profile' ? 'codegram_profiles' : 'codegram_media';
      const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'image';

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(
        `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
        {
          folder: folder,
          resource_type: resourceType,
          public_id: `${Date.now()}-${file.originalname.split('.')[0]}`, // Generate public_id
        }
      );

      uploadedFiles.push({
        public_id: result.public_id, // Store Cloudinary's public ID
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: result.secure_url, // Cloudinary's secure URL
      });
    }

    res.json({
      message: 'Files uploaded successfully to Cloudinary',
      files: uploadedFiles,
    });
  } catch (error) {
    // Multer errors from fileFilter will be caught here
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Max 10MB allowed.' });
    }
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
};

export const deleteFile = async (req, res) => {
  try {
    const { type, publicId } = req.params; // Expect publicId from client, not filename
    // Determine resource type for Cloudinary deletion
    const resourceType = type === 'video' ? 'video' : 'image';

    // Delete from Cloudinary using publicId
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });

    if (result.result === 'ok') {
      res.json({ message: 'File deleted successfully from Cloudinary' });
    } else {
      res.status(404).json({ error: 'File not found on Cloudinary or deletion failed' });
    }
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    res.status(500).json({ error: 'Failed to delete file from Cloudinary' });
  }
};