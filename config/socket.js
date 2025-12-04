const jwt = require('jsonwebtoken');
const { registerUserSocket, unregisterUserSocket } = require('../utils/notifications');

/**
 * Configure Socket.IO with authentication
 */
function configureSocket(io) {
    // Middleware for authentication
    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.user_id;
            socket.username = decoded.username;
            next();
        } catch (error) {
            next(new Error('Authentication error: Invalid token'));
        }
    });

    // Handle connections
    io.on('connection', (socket) => {
        const userId = socket.userId;
        
        // Register user connection
        registerUserSocket(userId, socket.id);

        // Send initial unread count
        const notificationUtils = require('../utils/notifications');
        notificationUtils.emitUnreadCount(userId).catch(console.error);

        // Handle user requesting their notifications
        socket.on('get_notifications', async (data) => {
            try {
                const { query } = require('../config/database');
                const limit = data?.limit || 50;
                const unread_only = data?.unread_only || false;

                let queryStr = `
                    SELECT n.*, 
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
                    WHERE n.user_id = ?
                `;

                const params = [userId];

                if (unread_only) {
                    queryStr += ' AND n.is_read = FALSE';
                }

                queryStr += ' ORDER BY n.created_at DESC LIMIT ?';
                params.push(parseInt(limit));

                const notifications = await query(queryStr, params);
                socket.emit('notifications_list', { notifications });
            } catch (error) {
                console.error('Error fetching notifications:', error);
                socket.emit('error', { message: 'Failed to fetch notifications' });
            }
        });

        // Handle marking notification as read
        socket.on('mark_as_read', async (data) => {
            try {
                const { notificationId } = data;
                await notificationUtils.markAsRead(notificationId, userId);
                socket.emit('marked_as_read', { notificationId, success: true });
            } catch (error) {
                console.error('Error marking notification as read:', error);
                socket.emit('error', { message: 'Failed to mark as read' });
            }
        });

        // Handle marking all as read
        socket.on('mark_all_as_read', async () => {
            try {
                await notificationUtils.markAllAsRead(userId);
                socket.emit('marked_all_as_read', { success: true });
            } catch (error) {
                console.error('Error marking all as read:', error);
                socket.emit('error', { message: 'Failed to mark all as read' });
            }
        });

        // Handle ping for connection keepalive
        socket.on('ping', () => {
            socket.emit('pong');
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            unregisterUserSocket(userId);
        });
    });

    return io;
}

module.exports = { configureSocket };
