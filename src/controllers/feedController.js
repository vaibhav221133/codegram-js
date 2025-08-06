import { prisma } from '../config/db.js'; // Added .js extension
// Removed Snippet, Doc, Bug, Like, Bookmark, User types

// Removed all type definitions for Feed Controller

export const getFeed = async (req, res) => { // Removed type annotations
  try {
    const userId = req.user.id; // Removed type assertion
    const page = parseInt(req.query.page) || 1; // Removed type assertion
    const limit = parseInt(req.query.limit) || 10; // Removed type assertion
    const skip = (page - 1) * limit;

    // Get users that the current user follows
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIds = following.map((f) => f.followingId); // Removed type annotation
    followingIds.push(userId); // Include user's own content

    // Get mixed content from followed users
    const [snippets, docs, bugs] = await Promise.all([
      prisma.snippet.findMany({
        where: { authorId: { in: followingIds }, isPublic: true },
        include: {
          author: { select: { id: true, username: true, name: true, avatar: true } },
          _count: { select: { likes: true, comments: true, bookmarks: true } },
          likes: { where: { userId }, select: { id: true } },
          bookmarks: { where: { userId }, select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit * 0.7),
      }),
      prisma.doc.findMany({
        where: { authorId: { in: followingIds }, isPublic: true },
        include: {
          author: { select: { id: true, username: true, name: true, avatar: true } },
          _count: { select: { likes: true, comments: true, bookmarks: true } },
          likes: { where: { userId }, select: { id: true } },
          bookmarks: { where: { userId }, select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit * 0.2),
      }),
      prisma.bug.findMany({
        where: { authorId: { in: followingIds }, expiresAt: { gt: new Date() } },
        include: {
          author: { select: { id: true, username: true, name: true, avatar: true } },
          _count: { select: { likes: true, comments: true, bookmarks: true } },
          likes: { where: { userId }, select: { id: true } },
          bookmarks: { where: { userId }, select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit * 0.1),
      }),
    ]);

    // Format and combine all content
    const feedItems = [ // Removed type annotation
      ...snippets.map((item) => ({ // Removed type assertion and type annotation
        ...item,
        type: 'snippet',
        isLiked: item.likes.length > 0,
        isBookmarked: item.bookmarks.length > 0,
        likesCount: item._count.likes,
        commentsCount: item._count.comments,
        bookmarksCount: item._count.bookmarks,
      })),
      ...docs.map((item) => ({ // Removed type assertion and type annotation
        ...item,
        type: 'doc',
        isLiked: item.likes.length > 0,
        isBookmarked: item.bookmarks.length > 0,
        likesCount: item._count.likes,
        commentsCount: item._count.comments,
        bookmarksCount: item._count.bookmarks,
      })),
      ...bugs.map((item) => ({ // Removed type assertion and type annotation
        ...item,
        type: 'bug',
        isLiked: item.likes.length > 0,
        isBookmarked: item.bookmarks.length > 0,
        likesCount: item._count.likes,
        commentsCount: item._count.comments,
        bookmarksCount: item._count.bookmarks,
      })),
    ];

    // Sort by creation date
    feedItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    const paginatedItems = feedItems.slice(skip, skip + limit);

    // If no followed content, show public content
    if (feedItems.length === 0 && page === 1) {
      const publicSnippets = await prisma.snippet.findMany({
        where: { isPublic: true },
        include: {
          author: { select: { id: true, username: true, name: true, avatar: true } },
          _count: { select: { likes: true, comments: true, bookmarks: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      });

      const publicFeedItems = publicSnippets.map((item) => ({ // Removed type assertion and type annotation
        ...item,
        type: 'snippet',
        likesCount: item._count.likes,
        commentsCount: item._count.comments,
        bookmarksCount: item._count.bookmarks,
      }));

      return res.json({
        data: publicFeedItems,
        total: publicFeedItems.length,
        page,
        hasMore: publicSnippets.length === limit,
      });
    }

    res.json({
      data: paginatedItems,
      total: feedItems.length,
      page,
      hasMore: feedItems.length > skip + limit,
    });
  } catch (error) {
    console.error('Error fetching feed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPublicFeed = async (req, res) => { // Removed type annotations
  try {
    const page = parseInt(req.query.page) || 1; // Removed type assertion
    const limit = parseInt(req.query.limit) || 10; // Removed type assertion
    const skip = (page - 1) * limit;

    const snippets = await prisma.snippet.findMany({
      where: { isPublic: true },
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
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });

    const feedItems = snippets.map((item) => ({ // Removed type assertion and type annotation
      ...item,
      type: 'snippet',
      likesCount: item._count.likes,
      commentsCount: item._count.comments,
      bookmarksCount: item._count.bookmarks,
    }));

    res.json({
      data: feedItems,
      total: feedItems.length,
      page,
      hasMore: snippets.length === limit,
    });
  } catch (error) {
    console.error('Error fetching public feed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};