import { prisma } from '../config/db.js'; // Added .js extension
// Removed BugStatus as BugStatusEnum, Like, Bookmark, Bug types
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js'; // Added .js extension
import { emitToFollowers } from '../socket.js'; // Added .js extension
import * as notificationService from '../services/notificationService.js'; // Added .js extension

// Removed type definitions for Bug Controller

// Zod schema for bug creation - Zod schemas remain the same
const bugSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().min(1, "Description is required").max(500),
  content: z.string().min(1, "Content is required"),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  tags: z.array(z.string()).default([]),
  media: z.array(z.string()).optional(),
});

// Zod schema for bug status update - Zod schemas remain the same
const updateStatusSchema = z.object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
});


// Get all active bugs with pagination
export const getAllBugs = asyncHandler(async (req, res) => { // Removed type annotations
    const page = parseInt(req.query.page) || 1; // Removed type assertion
    const limit = parseInt(req.query.limit) || 10; // Removed type assertion
    const search = req.query.search; // Removed type assertion
    const severity = req.query.severity; // Removed type assertion
    const status = req.query.status; // Removed type assertion
    const tags = req.query.tags; // Removed type assertion
    const skip = (page - 1) * limit;
    const currentUserId = req.user?.id; // Removed type assertion

    const where = { // Removed : any
      expiresAt: { gt: new Date() }, // Only show active bugs
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (tags) where.tags = { hasSome: tags.split(',') };

    const [bugs, total] = await Promise.all([
      prisma.bug.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: { id: true, username: true, name: true, avatar: true },
          },
          _count: {
            select: { likes: true, comments: true, bookmarks: true, views: true },
          },
          ...(currentUserId ? {
              likes: { where: { userId: currentUserId }, select: { id: true } },
              bookmarks: { where: { userId: currentUserId }, select: { id: true } },
          } : {}),
        },
      }),
      prisma.bug.count({ where }),
    ]);

    const formattedBugs = bugs.map(bug => ({ // Removed type assertion
        ...bug,
        isLiked: bug.likes ? bug.likes.length > 0 : false,
        isBookmarked: bug.bookmarks ? bug.bookmarks.length > 0 : false,
        likesCount: bug._count.likes,
        commentsCount: bug._count.comments,
        bookmarksCount: bug._count.bookmarks,
        viewsCount: bug._count.views,
        likes: undefined,
        bookmarks: undefined,
    }));

    res.json({
      bugs: formattedBugs,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
    });
});

// Get single bug
export const getBugById = asyncHandler(async (req, res) => { // Removed type annotations
    const currentUserId = req.user?.id; // Removed type assertion
    const bug = await prisma.bug.findUnique({
      where: { id: req.params.id },
      include: {
        author: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        comments: {
          include: {
            author: {
              select: { id: true, username: true, name: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { likes: true, comments: true, bookmarks: true, views: true },
        },
        ...(currentUserId ? {
            likes: { where: { userId: currentUserId }, select: { id: true } },
            bookmarks: { where: { userId: currentUserId }, select: { id: true } },
        } : {}),
      },
    });

    if (!bug) {
      return res.status(404).json({ error: 'Bug not found' });
    }

    if (bug.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Bug report has expired' });
    }

    const bugWithInteractions = bug; // Removed type assertion

    const formattedBug = {
        ...bug,
        isLiked: bugWithInteractions.likes ? bugWithInteractions.likes.length > 0 : false,
        isBookmarked: bugWithInteractions.bookmarks ? bugWithInteractions.bookmarks.length > 0 : false,
        likesCount: bug._count.likes,
        commentsCount: bug._count.comments,
        bookmarksCount: bug._count.bookmarks,
        viewsCount: bug._count.views,
        likes: undefined,
        bookmarks: undefined,
    };

    res.json(formattedBug);
});

// Create bug
export const createBug = asyncHandler(async (req, res) => { // Removed type annotations
    const validatedData = bugSchema.parse(req.body);
    const userId = req.user.id; // Removed type assertion
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Bugs expire in 24 hours
    
    const bug = await prisma.bug.create({
      data: {
        ...validatedData,
        authorId: userId,
        expiresAt,
      },
      include: {
        author: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        _count: {
          select: { likes: true, comments: true, bookmarks: true },
        },
      },
    });

    // --- Real-time Feed Logic ---
    emitToFollowers(userId, 'new-bug', bug);

    res.status(201).json(bug);
});

// Update bug status
export const updateBugStatus = asyncHandler(async (req, res) => { // Removed type annotations
    const { status } = updateStatusSchema.parse(req.body);
    const bugId = req.params.id;
    const currentUserId = req.user.id; // Removed type assertion
    
    const bug = await prisma.bug.findUnique({
      where: { id: bugId },
    });

    if (!bug) {
      return res.status(404).json({ error: 'Bug not found' });
    }

    if (bug.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Bug report has expired' });
    }

    // Allow only the bug author to change the status
    if (bug.authorId !== currentUserId) {
      return res.status(403).json({ error: 'Access denied: Only the author can change the status.' });
    }

    const updatedBug = await prisma.bug.update({
      where: { id: bugId },
      data: { status: status }, // Removed 'as BugStatusEnum'
      include: {
        author: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        _count: {
          select: { likes: true, comments: true, bookmarks: true },
        },
      },
    });

    // --- Real-time Notification Logic ---
    // Notify the author that their bug status was updated.
    // This is useful if, in the future, moderators can also change status.
    // We check `bug.authorId !== currentUserId` to prevent self-notifications.
    if (bug.authorId !== currentUserId) {
        await notificationService.createNotification({
            recipientId: bug.authorId,
            senderId: currentUserId,
            type: 'BUG_STATUS_UPDATE',
            bugId: bug.id,
        });
    }

    res.json(updatedBug);
});

// Delete bug
export const deleteBug = asyncHandler(async (req, res) => {
    const bugId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role; // Assuming role is available on req.user

    const bug = await prisma.bug.findUnique({
      where: { id: bugId },
    });

    if (!bug) {
      return res.status(404).json({ error: 'Bug not found' });
    }

    // Allow owner OR admin to delete
    if (bug.authorId !== userId && userRole !== 'ADMIN') {
      // logger.warn('Unauthorized delete attempt (Bug):', { userId, bugId }); // Consider adding logger import
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.$transaction([
      prisma.like.deleteMany({ where: { bugId } }),
      prisma.bookmark.deleteMany({ where: { bugId } }),
      prisma.comment.deleteMany({ where: { bugId } }),
      prisma.bugView.deleteMany({ where: { bugId } }),
      prisma.bug.delete({ where: { id: bugId } }),
    ]);

    // logger.info('Bug deleted (Admin/Owner):', { bugId, deletedBy: userId, ownerId: bug.authorId }); // Consider adding logger import
    res.json({ message: 'Bug deleted successfully' });
});

// Add bug view
export const addBugView = asyncHandler(async (req, res) => { // Removed type annotations
    const { bugId } = req.params;
    const userId = req.user.id; // Removed type assertion

    // Use upsert for a more concise operation
    await prisma.bugView.upsert({
        where: {
            bugId_userId: { bugId, userId },
        },
        update: {}, // Do nothing if it exists
        create: { bugId, userId },
    });

    res.status(200).json({ message: 'Bug view recorded' });
});

// Get bug views
export const getBugViews = asyncHandler(async (req, res) => { // Removed type annotations
    const { bugId } = req.params;

    const views = await prisma.bugView.findMany({
      where: { bugId },
      include: {
        user: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });

    res.json(views);
});