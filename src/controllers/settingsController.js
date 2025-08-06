import { prisma } from '../config/db.js';
import { z } from 'zod';
import { env } from '../config/environment.js'; // Import env to construct the URL

const preferencesSchema = z.object({
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
  language: z.string().min(2).max(5).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    mentions: z.boolean().optional(),
    likes: z.boolean().optional(),
    comments: z.boolean().optional(),
    follows: z.boolean().optional(),
  }).optional(),
  privacy: z.object({
    showEmail: z.boolean().optional(),
    showLocation: z.boolean().optional(),
    showGithub: z.boolean().optional(),
    allowDirectMessages: z.boolean().optional(),
    profileVisibility: z.enum(['public', 'private']).optional(), // Added profile visibility
  }).optional(),
});

const profileUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional().or(z.literal('')),
  location: z.string().max(100).optional(),
  techStack: z.array(z.string()).max(20).optional(),
  avatar: z.string().url().optional(), // This schema field now primarily validates if a URL is provided in body
  gender: z.string().optional(),
});

// Get user preferences (no changes needed)
export const getPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    let preferences = await prisma.userPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      // Create default preferences
      preferences = await prisma.userPreferences.create({
        data: {
          userId,
          theme: 'SYSTEM',
          language: 'en',
          notifications: {
            email: true,
            push: true,
            mentions: true,
            likes: true,
            comments: true,
            follows: true,
          },
          privacy: {
            showEmail: false,
            showLocation: true,
            showGithub: true,
            allowDirectMessages: true,
            profileVisibility: 'public',
          },
        },
      });
    }

    res.json(preferences);
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
};

// Update user preferences (no changes needed)
export const updatePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = preferencesSchema.parse(req.body);

    let preferences = await prisma.userPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: {
          userId,
          theme: updates.theme || 'SYSTEM',
          language: updates.language || 'en',
          notifications: updates.notifications || {
            email: true,
            push: true,
            mentions: true,
            likes: true,
            comments: true,
            follows: true,
          },
          privacy: updates.privacy || {
            showEmail: false,
            showLocation: true,
            showGithub: true,
            allowDirectMessages: true,
            profileVisibility: 'public',
          },
        },
      });
    } else {
      const updateData = {};
      
      if (updates.theme) updateData.theme = updates.theme;
      if (updates.language) updateData.language = updates.language;
      
      if (updates.notifications) {
        updateData.notifications = {
          ...preferences.notifications,
          ...updates.notifications,
        };
      }
      
      if (updates.privacy) {
        updateData.privacy = {
          ...preferences.privacy,
          ...updates.privacy,
        };
      }

      preferences = await prisma.userPreferences.update({
        where: { userId },
        data: updateData,
      });
    }

    res.json({
      message: 'Preferences updated successfully',
      preferences,
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
};

// Update user profile (modified to handle file uploads for avatar)
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    // We parse `req.body` but will override `avatar` if `req.file` exists
    const updates = profileUpdateSchema.partial().parse(req.body); // Use partial to allow partial updates

    const dataToUpdate = { ...updates }; // Start with validated body data

    // If a file was uploaded by multer, use its filename to construct the avatar URL
    if (req.file) {
      // Ensure the 'type' parameter is available for constructing the URL if needed,
      // though multer's destination already handles `profileDir`.
      const uploadType = req.params.type || 'profiles'; // Default to 'profiles'
      const baseUrl = env.BASE_URL;
      dataToUpdate.avatar = `${baseUrl}/uploads/${uploadType}/${req.file.filename}`;
      // Remove avatar from updates if it was present in the body and a file was uploaded
      delete dataToUpdate.avatar; // Ensure body.avatar doesn't override the file URL
    } else if ('avatar' in req.body && req.body.avatar === '') {
      // Allow clearing the avatar by sending an empty string for the 'avatar' field
      dataToUpdate.avatar = null;
    }


    const user = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate, // Use dataToUpdate, which now includes the avatar URL if uploaded
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        bio: true,
        avatar: true, // Select avatar to confirm update
        githubUrl: true,
        website: true,
        location: true,
        techStack: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            snippets: true,
            docs: true,
            bugs: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    res.json({
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    // Multer errors might come here if file size/type limits are hit before Zod validation
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    // Handle Multer's specific error for file filter
    if (error.code === 'LIMIT_FILE_SIZE' || error.message.includes('Invalid file type')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// Delete account (no changes needed)
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { confirmPassword } = z.object({
      confirmPassword: z.string().min(1),
    }).parse(req.body);

    if (confirmPassword !== 'DELETE_MY_ACCOUNT') {
      return res.status(400).json({
        error: 'Invalid confirmation. Type "DELETE_MY_ACCOUNT" to confirm.'
      });
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    req.logout((err) => {
      if (err) {
        console.error('Logout error during account deletion:', err);
      }
    });

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};

// Get user dashboard stats (no changes needed)
export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const [
      snippetStats,
      docStats,
      bugStats,
      interactionStats,
      followStats,
    ] = await Promise.all([
      prisma.snippet.aggregate({
        where: { authorId: userId },
        _count: { id: true },
      }),
      prisma.doc.aggregate({
        where: { authorId: userId },
        _count: { id: true },
      }),
      prisma.bug.aggregate({
        where: { authorId: userId },
        _count: { id: true },
      }),
      prisma.like.aggregate({
        where: {
          OR: [
            { snippet: { authorId: userId } },
            { doc: { authorId: userId } },
            { bug: { authorId: userId } },
          ]
        },
        _count: { id: true },
      }),
      prisma.follow.aggregate({
        where: { followingId: userId },
        _count: { id: true },
      }),
    ]);

    const stats = {
      content: {
        snippets: snippetStats._count.id,
        docs: docStats._count.id,
        bugs: bugStats._count.id,
      },
      engagement: {
        totalLikes: interactionStats._count.id,
        followers: followStats._count.id,
      },
    };

    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};