import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import passport from 'passport';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import connectPgSimple from 'connect-pg-simple';
import { authLimiter, uploadLimiter, apiLimiter, enhancedCSP, sanitizeInput, validatePagination } from './middlewares/securityMiddleware.js';
import { env, getSessionConfig } from './config/environment.js';
import { checkDatabaseHealth } from './config/db.js';
import { logger } from './utils/logger.js';
import { prisma } from './config/db.js';
import { configurePassport } from './config/passport.js';
import { errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import snippetRoutes from './routes/snippetRoutes.js';
import docRoutes from './routes/docRoutes.js';
import bugRoutes from './routes/bugRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import likeRoutes from './routes/likeRoutes.js';
import bookmarkRoutes from './routes/bookmarkRoutes.js';
import followRoutes from './routes/followRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import moderationRoutes from './routes/moderationRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import feedRoutes from './routes/feedRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { cache } from './utils/cache.js';

const swaggerFile = JSON.parse(fs.readFileSync('./swagger-output.json', 'utf-8'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- CORS Configuration ---
const frontendUrl = env.FRONTEND_URL;
const backendUrl = env.BACKEND_URL;

const whitelist = [frontendUrl, backendUrl];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request from origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// --- Security Middleware ---
app.use(helmet(enhancedCSP));

// --- Enhanced Rate Limiting ---
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/upload', uploadLimiter);

app.use('/api/admin', adminRoutes);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeInput);

app.use(express.static(path.join(__dirname, '../public')));
app.use('/swagger-output.json', express.static(path.join(__dirname, '../swagger-output.json')));

// --- Session and Passport Configuration ---
const sessionConfig = getSessionConfig();
const PgStore = connectPgSimple(session);

app.use(session({
    ...sessionConfig,
    store: new PgStore({
        conString: env.DATABASE_URL,
        createTableIfMissing: true,
    }),
}));

configurePassport(passport);
app.use(passport.initialize());
app.use(passport.session());

// --- API Docs ---
app.get('/api-docs', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/redoc.html'));
});

const swaggerUiOptions = {
  customSiteTitle: "CodeGram API - Interactive Docs",
  swaggerOptions: {
    persistAuthorization: true,
  },
};
app.use('/api-docs-ui', swaggerUi.serve, swaggerUi.setup(swaggerFile, swaggerUiOptions));

// --- Health Check with Database ---
app.get('/health', async (req, res) => {
  const dbHealthy = await checkDatabaseHealth();

  const status = dbHealthy ? 'OK' : 'UNHEALTHY';
  const statusCode = dbHealthy ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    database: dbHealthy ? 'connected' : 'disconnected',
    redis: 'not configured/disabled',
    environment: env.NODE_ENV,
  });
});

// --- API Routes ---
app.use('/api/snippets', validatePagination);
app.use('/api/docs', validatePagination);
app.use('/api/bugs', validatePagination);
app.use('/api/feed', validatePagination);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/snippets', snippetRoutes);
app.use('/api/docs', docRoutes);
app.use('/api/bugs', bugRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);

// --- Distributed Cron Job (only run on primary instance) ---
const isPrimaryInstance = process.env.PRIMARY_INSTANCE === 'true' || env.NODE_ENV === 'development';

if (isPrimaryInstance) {
  cron.schedule('0 * * * *', async () => {
    try {
      await prisma.bug.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      logger.info('Expired bugs cleaned up');
    } catch (error) {
      logger.error('Error cleaning up expired bugs:', error);
    }
  });
  logger.info('Cron jobs initialized on primary instance');
} else {
  logger.info('Cron jobs skipped on secondary instance');
}

// --- Error Handling ---
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

export default app;