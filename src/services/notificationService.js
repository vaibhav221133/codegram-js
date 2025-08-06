import { prisma } from '../config/db.js'; // Added .js extension
import { getIO } from '../socket.js'; // Added .js extension
// Removed NotificationType type (enum values will be used as strings or numbers directly in JS)

// Removed Interface defining the structure for creating a new notification.

/**
 * Creates a notification, saves it to the database, and emits a real-time socket event.
 * @param {object} data - The data for the notification to be created. // Updated JSDoc for JavaScript
 */
export const createNotification = async (data) => { // Removed type annotation
    // Don't create notifications for actions on your own content
    if (data.recipientId === data.senderId) {
        return;
    }

    // Create the notification record in the database.
    const notification = await prisma.notification.create({
        data,
        // Include sender details to display in the notification toast.
        include: {
            sender: {
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
    const io = getIO();
    // Emit the 'new_notification' event to the recipient's private room.
    io.to(data.recipientId).emit('new_notification', notification);
};

// --- Your other notification functions remain unchanged ---

export const getNotifications = async (userId, page, limit) => { // Removed type annotations
    const skip = (page - 1) * limit;
    const notifications = await prisma.notification.findMany({
        where: { recipientId: userId },
        include: {
            sender: {
                select: {
                    id: true,
                    username: true,
                    name: true,
                    avatar: true,
                },
            },
            snippet: {
                select: {
                    id: true,
                    title: true,
                },
            },
            doc: {
                select: {
                    id: true,
                    title: true,
                },
            },
            bug: {
                select: {
                    id: true,
                    title: true,
                },
            },
            comment: {
                select: {
                    id: true,
                    content: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
    });

    const total = await prisma.notification.count({
        where: { recipientId: userId },
    });

    return { notifications, total, page, limit };
};

export const markNotificationsAsRead = async (userId, notificationIds) => { // Removed type annotations
    const where = { recipientId: userId }; // Removed type annotation
    if (notificationIds && notificationIds.length > 0) {
        where.id = { in: notificationIds };
    }
    await prisma.notification.updateMany({
        where,
        data: { read: true },
    });
};

export const getUnreadNotificationCount = async (userId) => { // Removed type annotation
    return prisma.notification.count({
        where: {
            recipientId: userId,
            read: false,
        },
    });
};