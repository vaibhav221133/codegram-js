import { prisma } from '../config/db.js'; // Added .js extension
import { asyncHandler } from '../utils/asyncHandler.js'; // Added .js extension
import { z } from 'zod';
import { emitToFollowers } from '../socket.js'; // Added .js extension
// Removed Doc, Like, Bookmark types

// Removed type definitions for Doc Controller

// Zod schema for validating doc creation and updates - Zod schemas remain the same
const docSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  content: z.string().min(1, "Content cannot be empty"),
  isPublic: z.boolean().default(true),
});


/**
 * @desc    Get all public documents with pagination and filtering
 * @route   GET /api/docs
 * @access  Public
 */
export const getAllDocs = asyncHandler(async (req, res) => { // Removed type annotations
    const page = parseInt(req.query.page) || 1; // Removed type assertion
    const limit = parseInt(req.query.limit) || 10; // Removed type assertion
    const skip = (page - 1) * limit;
    const currentUserId = req.user?.id; // Removed type assertion

    const where = { isPublic: true };

    const [docs, total] = await Promise.all([
        prisma.doc.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                author: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        avatar: true,
                    },
                },
                _count: {
                    select: {
                        likes: true,
                        comments: true,
                        bookmarks: true,
                    },
                },
                // Conditionally include user's own likes/bookmarks
                ...(currentUserId ? {
                    likes: { where: { userId: currentUserId }, select: { id: true } },
                    bookmarks: { where: { userId: currentUserId }, select: { id: true } },
                } : {}),
            },
        }),
        prisma.doc.count({ where }),
    ]);

    // Format docs to include interaction status
    const formattedDocs = docs.map((doc) => ({ // Removed type assertion
        ...doc,
        isLiked: doc.likes ? doc.likes.length > 0 : false,
        isBookmarked: doc.bookmarks ? doc.bookmarks.length > 0 : false,
        likesCount: doc._count.likes,
        commentsCount: doc._count.comments,
        bookmarksCount: doc._count.bookmarks,
        likes: undefined, // Remove arrays from final response
        bookmarks: undefined,
    }));

    res.json({
        docs: formattedDocs,
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        hasMore: skip + limit < total,
    });
});


/**
 * @desc    Get a single doc by its ID
 * @route   GET /api/docs/:id
 * @access  Public (with checks for private docs)
 */
export const getDocById = asyncHandler(async (req, res) => { // Removed type annotations
    const { id } = req.params;
    const currentUserId = req.user?.id; // Removed type assertion

    const doc = await prisma.doc.findUnique({
        where: { id },
        include: {
            author: {
                select: { id: true, username: true, name: true, avatar: true },
            },
            _count: {
                select: { likes: true, comments: true, bookmarks: true },
            },
            ...(currentUserId ? {
                likes: { where: { userId: currentUserId }, select: { id: true } },
                bookmarks: { where: { userId: currentUserId }, select: { id: true } },
            } : {}),
        },
    });

    if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
    }

    // If the doc is private, only the author can see it
    if (!doc.isPublic && doc.authorId !== currentUserId) {
        return res.status(403).json({ message: 'Access denied to this document' });
    }

    const docWithInteractions = doc; // Removed type assertion

    const formattedDoc = {
        ...doc,
        isLiked: docWithInteractions.likes ? docWithInteractions.likes.length > 0 : false,
        isBookmarked: docWithInteractions.bookmarks ? docWithInteractions.bookmarks.length > 0 : false,
        likesCount: doc._count.likes,
        commentsCount: doc._count.comments,
        bookmarksCount: doc._count.bookmarks,
        likes: undefined,
        bookmarks: undefined,
    };

    res.status(200).json(formattedDoc);
});


/**
 * @desc    Create a new document
 * @route   POST /api/docs
 * @access  Private
 */
export const createDoc = asyncHandler(async (req, res) => { // Removed type annotations
    const validatedData = docSchema.parse(req.body);
    const userId = req.user.id; // Removed type assertion

    const newDoc = await prisma.doc.create({
        data: {
            ...validatedData,
            authorId: userId,
        },
        include: {
            author: {
                select: { id: true, username: true, name: true, avatar: true },
            },
             _count: {
                select: { likes: true, comments: true, bookmarks: true },
            }
        },
    });

    // --- Real-time Feed Logic ---
    // If the doc is public, push it to followers' feeds
    if (newDoc.isPublic) {
        emitToFollowers(userId, 'new-doc', newDoc);
    }

    const formattedDoc = {
        ...newDoc,
        isLiked: false,
        isBookmarked: false,
        likesCount: 0,
        commentsCount: 0,
        bookmarksCount: 0,
    };

    res.status(201).json(formattedDoc);
});


/**
 * @desc    Update an existing document
 * @route   PUT /api/docs/:id
 * @access  Private
 */
export const updateDoc = asyncHandler(async (req, res) => { // Removed type annotations
    const { id } = req.params;
    const validatedData = docSchema.parse(req.body);
    const userId = req.user.id; // Removed type assertion

    const doc = await prisma.doc.findUnique({ where: { id } });

    if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
    }

    if (doc.authorId !== userId) {
        return res.status(403).json({ message: 'Not authorized to update this document' });
    }

    const updatedDoc = await prisma.doc.update({
        where: { id },
        data: {
            ...validatedData,
            updatedAt: new Date(),
        },
    });

    res.status(200).json(updatedDoc);
});


/**
 * @desc    Delete a document
 * @route   DELETE /api/docs/:id
 * @access  Private
 */
export const deleteDoc = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role; // Assuming role is available on req.user

    const doc = await prisma.doc.findUnique({ where: { id } });

    if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
    }

    // Allow owner OR admin to delete
    if (doc.authorId !== userId && userRole !== 'ADMIN') {
        // logger.warn('Unauthorized delete attempt (Doc):', { userId, docId: id }); // Consider adding logger import
        return res.status(403).json({ message: 'Not authorized to delete this document' });
    }

    // Use a transaction to delete the doc and all its related interactions
    await prisma.$transaction([
        prisma.like.deleteMany({ where: { docId: id } }),
        prisma.comment.deleteMany({ where: { docId: id } }),
        prisma.bookmark.deleteMany({ where: { docId: id } }),
        prisma.doc.delete({ where: { id } }),
    ]);

    // logger.info('Document deleted (Admin/Owner):', { docId: id, deletedBy: userId, ownerId: doc.authorId }); // Consider adding logger import
    res.status(200).json({ message: 'Document deleted successfully' });
});


/**
 * @desc    Get all docs created by a specific user
 * @route   GET /api/users/:username/docs
 * @access  Public
 */
export const getUserDocs = asyncHandler(async (req, res) => { // Removed type annotations
    const { username } = req.params;
    const page = parseInt(req.query.page) || 1; // Removed type assertion
    const limit = parseInt(req.query.limit) || 10; // Removed type assertion
    const skip = (page - 1) * limit;
    const currentUserId = req.user?.id; // Removed type assertion

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Show private docs only to the owner
    const where = { // Removed : any
        authorId: user.id,
        ...(currentUserId === user.id ? {} : { isPublic: true }),
    };

    const [docs, total] = await Promise.all([
        prisma.doc.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                author: {
                    select: { id: true, username: true, name: true, avatar: true },
                },
                _count: {
                    select: { likes: true, comments: true, bookmarks: true },
                },
                ...(currentUserId ? {
                    likes: { where: { userId: currentUserId }, select: { id: true } },
                    bookmarks: { where: { userId: currentUserId }, select: { id: true } },
                } : {}),
            },
        }),
        prisma.doc.count({ where }),
    ]);

    const formattedDocs = docs.map((doc) => ({ // Removed type assertion
        ...doc,
        isLiked: doc.likes ? doc.likes.length > 0 : false,
        isBookmarked: doc.bookmarks ? doc.bookmarks.length > 0 : false,
        likesCount: doc._count.likes,
        commentsCount: doc._count.comments,
        bookmarksCount: doc._count.bookmarks,
        likes: undefined,
        bookmarks: undefined,
    }));

    res.json({
        docs: formattedDocs,
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        hasMore: skip + limit < total,
    });
});