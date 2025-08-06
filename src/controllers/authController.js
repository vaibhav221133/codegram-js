import passport from 'passport';
import { prisma } from '../config/db.js'; // Added .js extension

// GitHub OAuth routes
export const githubAuth = passport.authenticate('github', { scope: ['user:email'] });

export const githubCallback = (req, res) => { // Removed type annotations
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const user = req.user; // Removed type assertion
    
    // Check if this is a new user (just created) or existing user
    // A new user would have minimal data (no bio, default values)
    const isNewUser = !user.bio || user.bio.trim() === '' || user.createdAt === user.updatedAt;
    
    if (isNewUser) {
        res.redirect(`${frontendUrl}/profile/setup`);
    } else {
        res.redirect(`${frontendUrl}/home`);
    }
};

// Get current user
export const getMe = async (req, res) => { // Removed type annotations
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.id }, // Removed type assertion
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                bio: true,
                avatar: true,
                githubUrl: true,
                website: true,
                location: true,
                techStack: true,
                role: true,
                twitterUsername: true,
                company: true,
                publicRepos: true,
                followersCount: true,
                followingCount: true,
                githubCreatedAt: true,
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

        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Logout
export const logout = (req, res, next) => { // Removed type annotations
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Error logging out' });
        }
        res.json({ message: 'Logged out successfully' });
    });
};