import { prisma } from '../config/db.js';
import { z } from 'zod';

const searchSchema = z.object({
    query: z.string().min(1).max(100).optional(),
    type: z.enum(['all', 'users', 'snippets', 'docs', 'bugs', 'trending']).default('all'),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(10),
    tags: z.string().optional(),
    language: z.string().optional(),
    sortBy: z.enum(['relevance', 'newest', 'oldest', 'popular']).default('relevance'),
});

const getOrderBy = (sortBy) => {
    switch (sortBy) {
        case 'newest':
            return { createdAt: 'desc' };
        case 'oldest':
            return { createdAt: 'asc' };
        case 'popular':
            return { likes: { _count: 'desc' } };
        case 'relevance':
        default:
            return { createdAt: 'desc' };
    }
};

export const searchAll = async (req, res) => {
    try {
        const { query, type, page, limit, tags, language, sortBy } = searchSchema.parse(req.query);

        if (type === 'trending') {
            return getTrending(req, res);
        }

        if (!query) {
            return res.json({
                query: '',
                type,
                results: {},
                pagination: {
                    page,
                    limit,
                    total: 0,
                },
            });
        }

        const skip = (page - 1) * limit;
        const tsQuery = query;

        const tagCondition = tags ? { tags: { hasSome: tags.split(',') } } : {};
        const languageCondition = language ? { language: { equals: language, mode: 'insensitive' } } : {};
        let results = {};

        // Use a raw query for full-text search to get relevance ranking
        const searchFn = async (modelName, where, include, orderBy) => {
            // Find content IDs and rank them by relevance
            const rawResults = await prisma.$queryRaw`
                SELECT id, "createdAt"
                FROM ${modelName}
                WHERE "searchVector" @@ plainto_tsquery('english', ${tsQuery})
                ORDER BY ts_rank("searchVector", plainto_tsquery('english', ${tsQuery})) DESC
                LIMIT ${limit} OFFSET ${skip}
            `;
            const ids = rawResults.map(r => r.id);

            // Fetch the full content based on the ranked IDs
            const items = await prisma[modelName].findMany({
                where: { id: { in: ids } },
                include: { ...include, _count: true },
                // Preserve the order from the raw query
                orderBy: { id: 'asc' }, // Placeholder, can be improved with a case statement
            });

            // Get total count
            const count = await prisma[modelName].count({
                where: {
                    searchVector: {
                        search: tsQuery,
                        mode: 'plain'
                    }
                }
            });
            return { data: items, total: count };
        };

        if (type === 'all' || type === 'users') {
            const userCondition = {
                OR: [
                    { username: { contains: query, mode: 'insensitive' } },
                    { name: { contains: query, mode: 'insensitive' } },
                    { bio: { contains: query, mode: 'insensitive' } },
                ],
                isBlocked: false,
            };
            const [users, userCount] = await Promise.all([
                prisma.user.findMany({
                    where: userCondition,
                    skip: type === 'users' ? skip : 0,
                    take: type === 'users' ? limit : 5,
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        bio: true,
                        avatar: true,
                        techStack: true,
                        _count: {
                            select: {
                                followers: true,
                                snippets: true,
                                docs: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                }),
                type === 'users' ? prisma.user.count({ where: userCondition }) : Promise.resolve(0),
            ]);
            results.users = { data: users, total: userCount };
        }

        if (type === 'all' || type === 'snippets') {
            const snippetWhere = {
                ...tagCondition,
                ...languageCondition,
                isPublic: true,
            };
            const [snippets, snippetCount] = await Promise.all([
                searchFn('snippet', { ...snippetWhere }, {
                    author: { select: { id: true, username: true, name: true, avatar: true } },
                }, getOrderBy(sortBy)),
                prisma.snippet.count({ where: { ...snippetWhere, searchVector: { search: tsQuery, mode: 'plain' } } })
            ]);
            results.snippets = { data: snippets.data, total: snippets.total };
        }

        if (type === 'all' || type === 'docs') {
            const docWhere = { ...tagCondition, isPublic: true };
            const [docs, docCount] = await Promise.all([
                searchFn('doc', { ...docWhere }, {
                    author: { select: { id: true, username: true, name: true, avatar: true } },
                }, getOrderBy(sortBy)),
                prisma.doc.count({ where: { ...docWhere, searchVector: { search: tsQuery, mode: 'plain' } } })
            ]);
            results.docs = { data: docs.data, total: docs.total };
        }

        if (type === 'all' || type === 'bugs') {
            const bugWhere = { ...tagCondition, expiresAt: { gt: new Date() } };
            const [bugs, bugCount] = await Promise.all([
                searchFn('bug', { ...bugWhere }, {
                    author: { select: { id: true, username: true, name: true, avatar: true } },
                }, getOrderBy(sortBy)),
                prisma.bug.count({ where: { ...bugWhere, searchVector: { search: tsQuery, mode: 'plain' } } })
            ]);
            results.bugs = { data: bugs.data, total: bugs.total };
        }

        res.json({
            query,
            type,
            results,
            pagination: {
                page,
                limit,
                total: Object.values(results).reduce((sum, result) => sum + (result.total || 0), 0),
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: 'Invalid query parameters',
                details: error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message,
                }))
            });
        }
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
};

export const getTrending = async (req, res) => {
    try {
        const { type = 'all', limit = 10 } = req.query;
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        let results = {};

        if (type === 'all' || type === 'snippets') {
            const trendingSnippets = await prisma.snippet.findMany({
                where: {
                    isPublic: true,
                    createdAt: { gte: weekAgo },
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
                    _count: {
                        select: {
                            likes: true,
                            comments: true,
                            bookmarks: true,
                        },
                    },
                },
                take: Number(limit),
                orderBy: [
                    { likes: { _count: 'desc' } },
                    { comments: { _count: 'desc' } },
                    { createdAt: 'desc' },
                ],
            });

            results.snippets = trendingSnippets;
        }

        if (type === 'all' || type === 'docs') {
            const trendingDocs = await prisma.doc.findMany({
                where: {
                    isPublic: true,
                    createdAt: { gte: weekAgo },
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
                    _count: {
                        select: {
                            likes: true,
                            comments: true,
                            bookmarks: true,
                        },
                    },
                },
                take: Number(limit),
                orderBy: [
                    { likes: { _count: 'desc' } },
                    { comments: { _count: 'desc' } },
                    { createdAt: 'desc' },
                ],
            });

            results.docs = trendingDocs;
        }

        if (type === 'all' || type === 'bugs') {
            const trendingBugs = await prisma.bug.findMany({
                where: {
                    expiresAt: { gt: new Date() },
                    createdAt: { gte: weekAgo },
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
                    _count: {
                        select: {
                            likes: true,
                            comments: true,
                        },
                    },
                },
                take: Number(limit),
                orderBy: [
                    { likes: { _count: 'desc' } },
                    { comments: { _count: 'desc' } },
                    { createdAt: 'desc' },
                ],
            });

            results.bugs = trendingBugs;
        }

        res.json({ type, results });
    } catch (error) {
        console.error('Trending error:', error);
        res.status(500).json({ error: 'Failed to fetch trending content' });
    }
};

export const getTags = async (req, res) => {
    try {
        const { limit = 20 } = req.query;

        const [snippetTags, docTags, bugTags] = await Promise.all([
            prisma.snippet.findMany({
                where: { isPublic: true },
                select: { tags: true },
            }),
            prisma.doc.findMany({
                where: { isPublic: true },
                select: { tags: true },
            }),
            prisma.bug.findMany({
                where: { expiresAt: { gt: new Date() } },
                select: { tags: true },
            }),
        ]);

        const allTags = [];

        [...snippetTags, ...docTags, ...bugTags].forEach(item => {
            if (item.tags) {
                allTags.push(...item.tags);
            }
        });

        const tagCounts = allTags.reduce((acc, tag) => {
            acc[tag] = (acc[tag] || 0) + 1;
            return acc;
        }, {});

        const popularTags = Object.entries(tagCounts)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, Number(limit));

        res.json({ tags: popularTags });
    } catch (error) {
        console.error('Tags error:', error);
        res.status(500).json({ error: 'Failed to fetch tags' });
    }
};