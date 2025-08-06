import { PrismaClient } from '@prisma/client';
import { env, getDatabaseConfig } from './environment.js'; // Added .js extension
import { logger } from '../utils/logger.js'; // Added .js extension

const config = getDatabaseConfig();

export const prisma = new PrismaClient(config);

// Connection event handlers
prisma.$on('error', (e) => {
  logger.error('Prisma error:', e);
});

if (env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug('Query:', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    });
  });
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Health check function
export const checkDatabaseHealth = async () => { // Removed : Promise<boolean>
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
};