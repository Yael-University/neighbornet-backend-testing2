const { query } = require('../config/database');

// Store for Socket.IO instance and connected users
let io = null;
const connectedUsers = new Map(); // userId -> socketId

/**
 * Initialize Socket.IO instance
 */
function initializeSocketIO(socketIOInstance) {
    io = socketIOInstance;
    console.log('✅ WebSocket notification system initialized');
}

/**
 * Register a user's socket connection
 */
function registerUserSocket(userId, socketId) {
    connectedUsers.set(userId, socketId);
    console.log(`👤 User ${userId} connected (socket: ${socketId})`);
}

/**
 * Unregister a user's socket connection
 */
function unregisterUserSocket(userId) {
    connectedUsers.delete(userId);
    console.log(`👤 User ${userId} disconnected`);
}

/**
 * Get socket ID for a user
 */
function getUserSocketId(userId) {
    return connectedUsers.get(userId);
}

/**
 * Create a notification and emit it in real-time
 */
async function createNotification({ 
    user_id, 
    type, 
    title, 
    content, 
    related_id = null, 
    related_type = null, 
    priority = 'normal' 
}) {
    try {
        // Validate type enum
        const validTypes = ['alert', 'message', 'event', 'badge', 'verification', 'system', 'group_invite', 'group'];
        if (!validTypes.includes(type)) {
            console.error(`Invalid notification type: ${type}`);
            return null;
        }

        // Insert into database
        const result = await query(
            `INSERT INTO Notifications (user_id, type, title, content, related_id, related_type, priority)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [user_id, type, title, content, related_id, related_type, priority]
        );

        const notificationId = result.insertId;

        // Get the full notification data
        const [notification] = await query(
            `SELECT n.*, 
                    CASE 
                        WHEN n.related_type = 'user' THEN u.display_name
                        WHEN n.related_type = 'post' THEN p.content
                        WHEN n.related_type = 'event' THEN e.title
                        WHEN n.related_type = 'group' THEN g.name
                        ELSE NULL
                    END as related_name
             FROM Notifications n
             LEFT JOIN Users u ON n.related_type = 'user' AND n.related_id = u.user_id
             LEFT JOIN Posts p ON n.related_type = 'post' AND n.related_id = p.post_id
             LEFT JOIN Events e ON n.related_type = 'event' AND n.related_id = e.event_id
             LEFT JOIN UserGroups g ON n.related_type = 'group' AND n.related_id = g.group_id
             WHERE n.notification_id = ?`,
            [notificationId]
        );

        // Check if user is connected via WebSocket
        const socketId = getUserSocketId(user_id);
        const isOnline = socketId && io;

        if (isOnline && notification.length > 0) {
            // User is online - send via WebSocket
            io.to(socketId).emit('new_notification', notification[0]);
            console.log(`🔔 WebSocket notification sent to user ${user_id} (${type}): ${title}`);
        } else {
            // User is offline - notification stored in database for later retrieval
            console.log(`📭 User ${user_id} offline - notification stored in database`);
        }

        return notification[0] || { notification_id: notificationId };
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
}

/**
 * Create notifications for multiple users
 */
async function createBulkNotifications(users, { type, title, content, related_id, related_type, priority = 'normal' }) {
    const promises = users.map(user_id => 
        createNotification({ user_id, type, title, content, related_id, related_type, priority })
    );
    return Promise.all(promises);
}

/**
 * Get unread notification count for a user
 */
async function getUnreadCount(userId) {
    const result = await query(
        'SELECT COUNT(*) as count FROM Notifications WHERE user_id = ? AND is_read = FALSE',
        [userId]
    );
    return result[0].count;
}

/**
 * Emit unread count update to a user
 */
async function emitUnreadCount(userId) {
    if (!io) return;
    
    const socketId = getUserSocketId(userId);
    if (socketId) {
        const count = await getUnreadCount(userId);
        io.to(socketId).emit('unread_count', { count });
    }
}

/**
 * Mark notification as read and emit update
 */
async function markAsRead(notificationId, userId) {
    await query(
        'UPDATE Notifications SET is_read = TRUE WHERE notification_id = ? AND user_id = ?',
        [notificationId, userId]
    );
    await emitUnreadCount(userId);
}

/**
 * Mark all notifications as read for a user
 */
async function markAllAsRead(userId) {
    await query(
        'UPDATE Notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
        [userId]
    );
    await emitUnreadCount(userId);
}

module.exports = {
    initializeSocketIO,
    registerUserSocket,
    unregisterUserSocket,
    getUserSocketId,
    createNotification,
    createBulkNotifications,
    getUnreadCount,
    emitUnreadCount,
    markAsRead,
    markAllAsRead
};
