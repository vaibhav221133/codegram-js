// src/controllers/adminController.js
import { prisma } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js'; // Import logger for internal logging

export const getPlatformStats = asyncHandler(async (req, res) => {
  logger.info('Admin accessed platform stats:', { userId: req.user.id });

  const [
    totalUsers,
    totalSnippets,
    totalDocs,
    totalBugs,
    totalLikes,
    totalComments,
    totalReports,
    pendingReports,
    latestUsers,
    latestReports,
    languagesUsed,
    tagsUsed,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.snippet.count({ where: { isPublic: true } }), // Only count public snippets
    prisma.doc.count({ where: { isPublic: true } }), // Only count public docs
    prisma.bug.count({ where: { expiresAt: { gt: new Date() } } }), // Only count active bugs
    prisma.like.count(),
    prisma.comment.count(),
    prisma.report.count(),
    prisma.report.count({ where: { status: 'PENDING' } }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, username: true, name: true, createdAt: true, avatar: true }
    }),
    prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        reason: true,
        status: true,
        createdAt: true,
        description: true,
        reporter: { select: { username: true } },
        reported: { select: { username: true } },
        snippetId: true, docId: true, bugId: true, commentId: true // Include content IDs
      }
    }),
    // Aggregate distinct languages used in snippets
    prisma.snippet.groupBy({
        by: ['language'],
        _count: { id: true },
        where: { isPublic: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5
    }),
    // Aggregate popular tags (requires manual aggregation as Prisma can't directly group by array elements)
    prisma.snippet.findMany({
        where: { isPublic: true },
        select: { tags: true }
    }),
    prisma.doc.findMany({
        where: { isPublic: true },
        select: { tags: true }
    }),
    prisma.bug.findMany({
        where: { expiresAt: { gt: new Date() } },
        select: { tags: true }
    })
  ]);

  // Manual aggregation for popular tags across different models
  const allTags = [...tagsUsed[0], ...tagsUsed[1], ...tagsUsed[2]]
        .flatMap(item => item.tags || [])
        .filter(tag => typeof tag === 'string' && tag.length > 0);

  const tagCounts = allTags.reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {});

  const popularTags = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 popular tags

  res.json({
    overview: {
      totalUsers,
      totalSnippets,
      totalDocs,
      totalBugs,
      totalLikes,
      totalComments,
      totalReports,
      pendingReports,
    },
    latestActivity: {
      latestUsers,
      latestReports: latestReports.map(report => ({
        ...report,
        // Add a content type for display
        contentType: report.snippetId ? 'Snippet' : report.docId ? 'Doc' : report.bugId ? 'Bug' : report.commentId ? 'Comment' : 'User'
      })),
    },
    contentTrends: {
        topLanguages: languagesUsed.map(l => ({ language: l.language, count: l._count.id })),
        popularTags: popularTags
    }
  });
});