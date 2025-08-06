import * as notificationService from '../services/notificationService.js'; // Added .js extension
import { asyncHandler } from '../utils/asyncHandler.js'; // Added .js extension

export const getNotifications = asyncHandler(async (req, res) => { // Removed type annotations
    const userId = req.user.id; // Removed type assertion
    const page = parseInt(req.query.page) || 1; // Removed type assertion
    const limit = parseInt(req.query.limit) || 10; // Removed type assertion

    const result = await notificationService.getNotifications(userId, page, limit);
    res.json(result);
});

export const markAsRead = asyncHandler(async (req, res) => { // Removed type annotations
    const userId = req.user.id; // Removed type assertion
    const { notificationIds } = req.body; // Optional: array of IDs to mark as read

    await notificationService.markNotificationsAsRead(userId, notificationIds);
    res.json({ message: 'Notifications marked as read' });
});

export const getUnreadCount = asyncHandler(async (req, res) => { // Removed type annotations
    const userId = req.user.id; // Removed type assertion
    const count = await notificationService.getUnreadNotificationCount(userId);
    res.json({ count });
});