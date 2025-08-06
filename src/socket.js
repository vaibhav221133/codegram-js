import { Server } from 'socket.io'; // Removed Socket type
import http from 'http';
import { prisma } from './config/db.js'; // Added .js extension
import { env } from './config/environment.js'; // Added .js extension
import { logger } from './utils/logger.js'; // Added .js extension

let io; // Removed : Server

/**
 * Initializes the Socket.IO server and sets up event listeners.
 * @param {object} server - The HTTP server to attach Socket.IO to. // Updated JSDoc for JavaScript
 * @returns {object} The initialized Socket.IO server instance. // Updated JSDoc for JavaScript
 */
export const initializeSocket = (server) => { // Removed type annotations
  io = new Server(server, {
    cors: {
      origin: env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true
    },
    // Production optimizations
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Connection logging and security
  io.on('connection', (socket) => { // Removed type annotation
    logger.info('Socket connection established:', {
      socketId: socket.id,
      ip: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'],
    });

    // Rate limiting for socket events
    const eventCounts = new Map(); // Removed type annotation
    const resetInterval = setInterval(() => {
      eventCounts.clear();
    }, 60000); // Reset every minute

    const checkRateLimit = (eventName, limit = 10) => { // Removed type annotations
      const count = eventCounts.get(eventName) || 0;
      if (count >= limit) {
        logger.warn('Socket rate limit exceeded:', {
          socketId: socket.id,
          eventName,
          count,
        });
        return false;
      }
      eventCounts.set(eventName, count + 1);
      return true;
    };
    /**
     * Handles a client joining their user-specific room for notifications.
     */
    socket.on('join-user-room', (userId) => { // Removed type annotation
      if (!checkRateLimit('join-user-room', 5)) return;
      
      // Validate userId format
      if (!userId || typeof userId !== 'string' || userId.length > 50) {
        logger.warn('Invalid userId in join-user-room:', { socketId: socket.id, userId });
        return;
      }
      
      if (userId) {
        socket.join(userId);
        logger.debug('Socket joined user room:', { socketId: socket.id, userId });
      }
    });

    /**
     * Handles a client joining a room for a specific content item to receive live updates.
     */
    socket.on('join-content-room', (contentId) => { // Removed type annotation
        if (!checkRateLimit('join-content-room', 10)) return;
        
        // Validate contentId format
        if (!contentId || typeof contentId !== 'string' || contentId.length > 50) {
          logger.warn('Invalid contentId in join-content-room:', { socketId: socket.id, contentId });
          return;
        }
        
        if(contentId) {
            socket.join(contentId);
            logger.debug('Socket joined content room:', { socketId: socket.id, contentId });
        }
    });

    /**
     * Handles a client leaving a content room when they navigate away.
     */
    socket.on('leave-content-room', (contentId) => { // Removed type annotation
        if (!checkRateLimit('leave-content-room', 10)) return;
        
        if (!contentId || typeof contentId !== 'string' || contentId.length > 50) {
          return;
        }
        
        if(contentId) {
            socket.leave(contentId);
            logger.debug('Socket left content room:', { socketId: socket.id, contentId });
        }
    });


    /**
     * Handles user disconnection.
     */
 socket.on('disconnect', (reason) => { // Removed type annotation
  clearInterval(resetInterval);
  logger.info('Socket disconnected:', {
    socketId: socket.id,
    reason,
  });
});


    // Handle connection errors
    socket.on('error', (error) => {
      logger.error('Socket error:', {
        socketId: socket.id,
        error: error.message,
      });
    });
  });

  // Global error handling
  io.engine.on('connection_error', (err) => {
    logger.error('Socket.IO connection error:', {
      code: err.code,
      message: err.message,
      context: err.context,
    });
  });

  return io;
};

/**
 * Retrieves the singleton Socket.IO server instance.
 */
export const getIO = () => { // Removed : Server
  if (!io) {
    throw new Error('Socket.io has not been initialized!');
  }
  return io;
};

/**
 * Emits a real-time event to all followers of a specific user.
 */
export const emitToFollowers = async (authorId, eventName, payload) => { // Removed type annotations
    try {
        // Validate inputs
        if (!authorId || !eventName || !payload) {
          logger.warn('Invalid parameters for emitToFollowers:', { authorId, eventName });
          return;
        }

        const followers = await prisma.follow.findMany({
            where: { followingId: authorId },
            select: { followerId: true }
        });

        const io = getIO();
        // Emit the event to each follower's private room.
        followers.forEach((follow) => { // Removed type annotation
            io.to(follow.followerId).emit(eventName, payload);
        });

        // Also emit to the author themselves so their own feed updates instantly.
        io.to(authorId).emit(eventName, payload);

        logger.debug('Event emitted to followers:', {
          authorId,
          eventName,
          followerCount: followers.length,
        });
    } catch (error) {
        logger.error('Error emitting event to followers:', {
          authorId,
          eventName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// At the end of src/socket.ts, add:
export const initSocket = initializeSocket;