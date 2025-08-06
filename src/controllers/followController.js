import { prisma } from '../config/db.js'; // Added .js extension
import * as notificationService from '../services/notificationService.js'; // Added .js extension
import { getIO } from '../socket.js'; // Added .js extension

// Follow/unfollow user
export const toggleFollow = async (req, res) => { // Removed type annotations
  try {
    const followingId = req.params.userId;
    const followerId = req.user.id; // Removed type assertion

    if (followerId === followingId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: followingId },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (existingFollow) {
      // Unfollow
      await prisma.follow.delete({
        where: { id: existingFollow.id },
      });
      res.json({ following: false, message: 'Unfollowed successfully' });
    } else {
      // Follow
      const follow = await prisma.follow.create({
        data: {
          followerId,
          followingId,
        },
        include: {
            follower: true,
        }
      });

      // Create notification
      await notificationService.createNotification({
          recipientId: followingId,
          senderId: followerId,
          type: 'FOLLOW',
      });

      // Emit event to the followed user
      getIO().to(followingId).emit('new-follower', follow.follower);

      res.json({ following: true, message: 'Followed successfully' });
    }
  } catch (error) {
    console.error('Error toggling follow:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Check if user is following another user
export const checkFollow = async (req, res) => { // Removed type annotations
  try {
    const followingId = req.params.userId;
    const followerId = req.user.id; // Removed type assertion

    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    res.json({ following: !!follow });
  } catch (error) {
    console.error('Error checking follow status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user's followers
export const getFollowers = async (req, res) => { // Removed type annotations
  try {
    const { userId } = req.params;
    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page); // Removed type assertion
    const limitNum = parseInt(limit); // Removed type assertion
    const skip = (pageNum - 1) * limitNum;

    const [followers, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followingId: userId },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          follower: {
            select: {
              id: true,
              username: true,
              name: true,
              avatar: true,
              bio: true,
              _count: {
                select: {
                  followers: true,
                  following: true,
                  snippets: true,
                },
              },
            },
          },
        },
      }),
      prisma.follow.count({ where: { followingId: userId } }),
    ]);

    res.json({
      followers: followers.map((f) => f.follower), // Removed type assertion
      total,
      pages: Math.ceil(total / limitNum),
      currentPage: pageNum,
    });
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user's following
export const getFollowing = async (req, res) => { // Removed type annotations
  try {
    const { userId } = req.params;
    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page); // Removed type assertion
    const limitNum = parseInt(limit); // Removed type assertion
    const skip = (pageNum - 1) * limitNum;

    const [following, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: userId },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          following: {
            select: {
              id: true,
              username: true,
              name: true,
              avatar: true,
              bio: true,
              _count: {
                select: {
                  followers: true,
                  following: true,
                  snippets: true,
                },
              },
            },
          },
        },
      }),
      prisma.follow.count({ where: { followerId: userId } }),
    ]);

    res.json({
      following: following.map((f) => f.following), // Removed type assertion
      total,
      pages: Math.ceil(total / limitNum),
      currentPage: pageNum,
    });
  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get suggested users to follow
export const getSuggestedUsers = async (req, res) => { // Removed type annotations
  try {
    const userId = req.user.id; // Removed type assertion
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit); // Removed type assertion

    // Get users that the current user is not following
    const suggestions = await prisma.user.findMany({
      where: {
        id: { not: userId },
        isBlocked: false,
        NOT: {
          followers: {
            some: { followerId: userId },
          },
        },
      },
      take: limitNum,
      orderBy: [
        { followers: { _count: 'desc' } },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        techStack: true,
        _count: {
          select: {
            followers: true,
            following: true,
            snippets: true,
          },
        },
      },
    });

    res.json({ suggestions });
  } catch (error) {
    console.error('Error fetching follow suggestions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};