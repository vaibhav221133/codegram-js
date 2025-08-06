import { prisma } from '../config/db.js';
import { z } from 'zod';
import * as notificationService from '../services/notificationService.js';
import { getIO } from '../socket.js'; // Ensure getIO is imported

const commentSchema = z.object({
  content: z.string().min(1).max(1000),
  snippetId: z.string().optional(),
  docId: z.string().optional(),
  bugId: z.string().optional(),
  parentId: z.string().optional(), // For replies
}).refine(
  (data) => {
    const targets = [data.snippetId, data.docId, data.bugId].filter(Boolean);
    return targets.length === 1;
  },
  {
    message: 'Comment must target exactly one content type',
  }
);

// Create comment (no changes needed here, as it already emits 'new_comment')
export const createComment = async (req, res) => {
  try {
    const validatedData = commentSchema.parse(req.body);
    const senderId = req.user.id;
    let contentAuthorId;
    let contentId;

    // Verify the target content exists
    if (validatedData.snippetId) {
      contentId = validatedData.snippetId;
      const snippet = await prisma.snippet.findUnique({
        where: { id: contentId },
      });
      if (!snippet) {
        return res.status(404).json({ error: 'Snippet not found' });
      }
      if (!snippet.isPublic) {
        return res.status(403).json({ error: 'Cannot comment on private snippet' });
      }
      contentAuthorId = snippet.authorId;
    }

    if (validatedData.docId) {
      contentId = validatedData.docId;
      const doc = await prisma.doc.findUnique({
        where: { id: contentId },
      });
      if (!doc) {
        return res.status(404).json({ error: 'Doc not found' });
      }
      if (!doc.isPublic) {
        return res.status(403).json({ error: 'Cannot comment on private doc' });
      }
      contentAuthorId = doc.authorId;
    }

    if (validatedData.bugId) {
      contentId = validatedData.bugId;
      const bug = await prisma.bug.findUnique({
        where: { id: contentId },
      });
      if (!bug) {
        return res.status(404).json({ error: 'Bug not found' });
      }
      if (bug.expiresAt < new Date()) {
        return res.status(410).json({ error: 'Bug report has expired' });
      }
      contentAuthorId = bug.authorId;
    }

    const comment = await prisma.comment.create({
      data: {
        ...validatedData,
        authorId: senderId,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // --- Real-time Logic ---
    // 1. Create notification for the content author
    if (contentAuthorId && contentAuthorId !== senderId) {
        await notificationService.createNotification({
            recipientId: contentAuthorId,
            senderId: senderId,
            type: validatedData.parentId ? 'REPLY' : 'COMMENT',
            commentId: comment.id,
            ...validatedData
        });
    }

    // 2. Broadcast the new comment to all clients in the content's room
    if (contentId) {
        const io = getIO();
        io.to(contentId).emit('new_comment', comment); // Existing new comment event
    }

    res.status(201).json(comment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update comment
export const updateComment = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    if (content.length > 1000) {
      return res.status(400).json({ error: 'Content too long' });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: req.params.id },
      select: { snippetId: true, docId: true, bugId: true, authorId: true } // Select contentId fields
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.authorId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedComment = await prisma.comment.update({
      where: { id: req.params.id },
      data: { content },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // Emit 'comment_updated' event to the relevant content room
    const contentId = updatedComment.snippetId || updatedComment.docId || updatedComment.bugId;
    if (contentId) {
        const io = getIO();
        io.to(contentId).emit('comment_updated', updatedComment);
    }

    res.json(updatedComment);
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete comment
export const deleteComment = async (req, res) => {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: req.params.id },
      select: { id: true, snippetId: true, docId: true, bugId: true, authorId: true }
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Allow owner OR admin to delete
    if (comment.authorId !== req.user.id && req.user.role !== 'ADMIN') { // Assuming role on req.user
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.comment.delete({
      where: { id: req.params.id },
    });

    const contentId = comment.snippetId || comment.docId || comment.bugId;
    if (contentId) {
        const io = getIO();
        io.to(contentId).emit('comment_deleted', { commentId: comment.id, contentId: contentId });
    }

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get comments for content (no changes needed)
export const getComments = async (req, res) => {
  try {
    const { snippetId, docId, bugId, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where = { parentId: null };

    if (snippetId) where.snippetId = snippetId;
    if (docId) where.docId = docId;
    if (bugId) where.bugId = bugId;

    if (!snippetId && !docId && !bugId) {
      return res.status(400).json({ error: 'Content ID is required' });
    }

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        skip,
        take: limitNum,
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
          replies: {
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  avatar: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      prisma.comment.count({ where }),
    ]);

    res.json({
      comments,
      total,
      pages: Math.ceil(total / limitNum),
      currentPage: pageNum,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};