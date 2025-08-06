import { prisma } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getUserProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;
    const currentUserId = req.user?.id;

    const user = await prisma.user.findUnique({
        where: { username },
        include: {
            preferences: true,
            _count: {
                select: {
                    followers: true,
                    following: true,
                    snippets: true,
                    docs: true,
                    bugs: true,
                },
            },
        },
    });

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    const privacy = user.preferences?.privacy;
    let filteredUserProfile = { ...user };
    let isPrivateProfile = false;
    let allowDirectMessages = true;

    if (privacy?.profileVisibility === 'private' && user.id !== currentUserId) {
        isPrivateProfile = true;
        filteredUserProfile = {
            id: user.id,
            username: user.username,
            name: user.name,
            avatar: user.avatar,
            bio: null,
            website: null,
            location: null,
            techStack: [],
            githubUrl: null,
            email: null,
            twitterUsername: null,
            company: null,
            publicRepos: null,
            followersCount: user._count.followers,
            followingCount: user._count.following,
            githubCreatedAt: null,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            role: user.role,
            isBlocked: user.isBlocked,
        };
        allowDirectMessages = false;
    } else {
        if (user.id !== currentUserId) {
            if (privacy?.showEmail === false) {
                filteredUserProfile.email = null;
            }
            if (privacy?.showLocation === false) {
                filteredUserProfile.location = null;
            }
            if (privacy?.showGithub === false) {
                filteredUserProfile.githubUrl = null;
            }
            if (privacy?.allowDirectMessages === false) {
                allowDirectMessages = false;
            }
        }
    }

    let isFollowing = false;
    let isBlockedByMe = false;

    if (currentUserId) {
        const follow = await prisma.follow.findUnique({
            where: {
                followerId_followingId: {
                    followerId: currentUserId,
                    followingId: user.id,
                },
            },
        });
        isFollowing = !!follow;

        const blocked = await prisma.blockedUser.findFirst({
            where: {
                blockerId: currentUserId,
                blockedId: user.id,
            },
        });
        isBlockedByMe = !!blocked;
    }

    const { preferences, ...originalUserProfileData } = user;

    const responsePayload = {
        user: filteredUserProfile,
        isPrivate: isPrivateProfile,
        isFollowing,
        isBlockedByMe,
        allowDirectMessages,
        followers: [],
        following: [],
        snippets: [],
        docs: [],
        bugs: [],
    };

    res.status(200).json(responsePayload);
});

export const getUserContent = asyncHandler(async (req, res) => {
    const { type = 'snippets', page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const user = await prisma.user.findUnique({
        where: { username: req.params.username },
        include: { preferences: true },
    });

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    const currentUserId = req.user?.id;
    const privacy = user.preferences?.privacy;

    if (privacy?.profileVisibility === 'private' && user.id !== currentUserId) {
        return res.json({ content: [], total: 0, pages: 0, currentPage: pageNum });
    }

    const where = {
        authorId: user.id,
    };

    let content = [];
    let total = 0;

    const includeOptions = {
        author: {
            select: { id: true, username: true, name: true, avatar: true },
        },
        _count: {
            select: { likes: true, comments: true, bookmarks: true },
        },
    };

    if (type === 'snippets') {
        [content, total] = await prisma.$transaction([
            prisma.snippet.findMany({ where, skip, take: limitNum, orderBy: { createdAt: 'desc' }, include: includeOptions }),
            prisma.snippet.count({ where }),
        ]);
    } else if (type === 'docs') {
        [content, total] = await prisma.$transaction([
            prisma.doc.findMany({ where, skip, take: limitNum, orderBy: { createdAt: 'desc' }, include: includeOptions }),
            prisma.doc.count({ where }),
        ]);
    } else if (type === 'bugs') {
        [content, total] = await prisma.$transaction([
            prisma.bug.findMany({ where: { ...where, expiresAt: { gt: new Date() } }, skip, take: limitNum, orderBy: { createdAt: 'desc' }, include: includeOptions }),
            prisma.bug.count({ where: { ...where, expiresAt: { gt: new Date() } } }),
        ]);
    } else {
        res.status(400);
        throw new Error('Invalid content type');
    }

    res.json({
        content,
        total,
        pages: Math.ceil(total / limitNum),
        currentPage: pageNum,
    });
});