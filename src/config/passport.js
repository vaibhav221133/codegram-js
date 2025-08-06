import { Strategy as GitHubStrategy } from 'passport-github2';
import { prisma } from './db.js';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { env } from './environment.js';

// GitHub profile validation schema
const githubProfileSchema = z.object({
  id: z.string(),
  username: z.string().min(1).max(39),
  displayName: z.string().nullable(),
  emails: z.array(z.object({
    value: z.string().email(),
    verified: z.boolean().optional(),
  })).optional(),
  profileUrl: z.string().url().optional(),
  _json: z.object({
    avatar_url: z.string().url().optional(),
    bio: z.string().nullable(),
    blog: z.string().nullable(),
    location: z.string().nullable(),
    twitter_username: z.string().nullable(),
    company: z.string().nullable(),
    public_repos: z.number().optional(),
    followers: z.number().optional(),
    following: z.number().optional(),
    created_at: z.string().optional(),
  }),
});

export const configurePassport = (passport) => {
    passport.use(new GitHubStrategy({
        clientID: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        callbackURL: '/api/auth/github/callback',
        scope: ['user:email'],
    }, async (accessToken, refreshToken, profile, done) => { // accessToken is available here
        try {
            const validationResult = githubProfileSchema.safeParse(profile);
            if (!validationResult.success) {
                logger.error('Invalid GitHub profile data:', validationResult.error);
                return done(new Error('Invalid profile data from GitHub'));
            }

            const validatedProfile = validationResult.data;
            const githubProfile = profile._json;

            let user = await prisma.user.findUnique({
                where: { githubId: validatedProfile.id },
            });

            const userData = {
                githubId: validatedProfile.id,
                username: validatedProfile.username,
                name: validatedProfile.displayName || validatedProfile.username,
                email: validatedProfile.emails?.[0]?.value ?? '',
                avatar: githubProfile.avatar_url,
                githubUrl: validatedProfile.profileUrl,
                bio: githubProfile.bio ?? '',
                website: githubProfile.blog ?? '',
                location: githubProfile.location ?? '',
                twitterUsername: githubProfile.twitter_username ?? null,
                company: githubProfile.company ?? null,
                publicRepos: githubProfile.public_repos ?? 0,
                followersCount: githubProfile.followers ?? 0,
                followingCount: githubProfile.following ?? 0,
                githubCreatedAt: githubProfile.created_at ? new Date(githubProfile.created_at) : null,
            };

            if (!userData.email) {
                return done(new Error('Email is required from GitHub profile'));
            }

            if (!user) {
                user = await prisma.user.create({
                    data: userData,
                });
                logger.info('New user created:', { userId: user.id, username: user.username });
            } else {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        ...userData,
                        email: validatedProfile.emails?.[0]?.value ?? user.email,
                    }
                });
                logger.info('User updated:', { userId: user.id, username: user.username });
            }

            // --- Store GitHub accessToken in session ---
            // Passport by default attaches `user` to `req.user`.
            // You can extend the user object or store it separately in the session.
            // For simplicity, let's attach it to the user object that gets serialized.
            // This assumes your `passport.serializeUser` also stores enough context.
            user.githubAccessToken = accessToken; // Add the token to the user object

            return done(null, user);
        } catch (error) {
            logger.error('GitHub OAuth error:', error);
            return done(error);
        }
    }));

    passport.serializeUser((user, done) => {
        // When serializing, you might want to store more than just the ID if the token is needed
        // However, usually, you'd fetch the user from DB in deserialize.
        // If you attach the token to the `user` object in `done(null, user)` above,
        // it means `user.githubAccessToken` is available here.
        done(null, { id: user.id, githubAccessToken: user.githubAccessToken }); // Store ID and token
    });

    // Deserialize user from session. This is where you can reattach the access token if needed
    // Note: Passport will call this with the serialized user objectwhich we defined in serializeUser. If you need the access token, you can fetch it from the user object. If you don't need the token here, you can just fetch the user by ID.

    passport.deserializeUser(async (serializedUser, done) => { // `serializedUser` now contains { id, githubAccessToken }
        try {
            const user = await prisma.user.findUnique({
                where: { id: serializedUser.id },
            });
            if (user) {
                user.githubAccessToken = serializedUser.githubAccessToken; // Reattach token to the user object
            }
            done(null, user || false);
        } catch (error) {
            logger.error('User deserialization error:', error);
            done(error, false);
        }
    });
}