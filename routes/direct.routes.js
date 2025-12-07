const express = require('express');
const router = express.Router();
const { pool, query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth.middleware');
const { validateDirectMessage } = require('../utils/validation');

/**
 * Send a direct message to another user
 * POST /api/direct/send
 */
router.post('/send', authenticateToken, async (req, res) => {
    const { receiver_id, content, media_url, media_type, media_size, thumbnail_url, duration, caption, reply_to_message_id } = req.body;
    const sender_id = req.user.user_id;

    // Validate input
    const validation = validateDirectMessage({ receiver_id, content });
    if (!validation.isValid) {
        return res.status(400).json({ error: validation.errors.join(', ') });
    }

    // Prevent sending messages to self
    if (sender_id === receiver_id) {
        return res.status(400).json({ error: "Cannot send message to yourself" });
    }

    try {
        // Check if receiver exists
        const receiver = await query(
            `SELECT user_id FROM Users WHERE user_id = ?`,
            [receiver_id]
        );

        if (!receiver || receiver.length === 0) {
            return res.status(404).json({ error: "Receiver not found" });
        }

        // If replying to a message, get the original message details
        let replyToContent = null;
        let replyToSenderId = null;
        if (reply_to_message_id) {
            const originalMsg = await query(
                `SELECT content, sender_id FROM DirectMessages 
                 WHERE message_id = ? AND (sender_id = ? OR receiver_id = ?)`,
                [reply_to_message_id, sender_id, sender_id]
            );
            if (originalMsg.length > 0) {
                replyToContent = originalMsg[0].content;
                replyToSenderId = originalMsg[0].sender_id;
            }
        }

        // Insert message
        const result = await query(
            `INSERT INTO DirectMessages (sender_id, receiver_id, content, media_url, media_type, media_size, thumbnail_url, duration, caption, reply_to_message_id, reply_to_content, reply_to_sender_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sender_id, receiver_id, content, media_url || null, media_type || null, media_size || null, thumbnail_url || null, duration || null, caption || null, reply_to_message_id || null, replyToContent, replyToSenderId]
        );

        // Get the created message
        const message = await query(
            `SELECT 
                dm.*,
                u.display_name as sender_name,
                u.username as sender_username,
                u.profile_image_url as sender_image,
                ru.display_name as reply_to_sender_name,
                ru.username as reply_to_sender_username
             FROM DirectMessages dm
             INNER JOIN Users u ON dm.sender_id = u.user_id
             LEFT JOIN Users ru ON dm.reply_to_sender_id = ru.user_id
             WHERE dm.message_id = ?`,
            [result.insertId]
        );

        // Create a notification
        await query(
            `INSERT INTO Notifications 
             (user_id, type, title, content, related_id, related_type)
             VALUES (?, 'message', 'New Message', ?, ?, 'user')`,
            [receiver_id, content.slice(0, 100), sender_id]
        );

        res.status(201).json({ success: true, message: message[0] });
    } catch (error) {
        console.error("DM Send Error:", error);
        res.status(500).json({ error: "Failed to send message" });
    }
});

/**
 * Get all messages between the authenticated user and another user (with pagination)
 * GET /api/direct/:userId/messages?limit=50&before=messageId
 */
router.get('/:userId/messages', authenticateToken, async (req, res) => {
    const userId = parseInt(req.params.userId);
    const selfId = req.user.user_id;
    const requestedLimit = parseInt(req.query.limit);
    const messageLimit = isNaN(requestedLimit) ? 50 : Math.min(requestedLimit, 200);
    const before = req.query.before;

    try {
        let sqlQuery = `
            SELECT dm.*,
                   u.display_name as sender_name,
                   u.username as sender_username,
                   u.profile_image_url as sender_image,
                   ru.display_name as reply_to_sender_name,
                   ru.username as reply_to_sender_username
            FROM DirectMessages dm
            INNER JOIN Users u ON dm.sender_id = u.user_id
            LEFT JOIN Users ru ON dm.reply_to_sender_id = ru.user_id
            WHERE (dm.sender_id = ? AND dm.receiver_id = ?)
               OR (dm.sender_id = ? AND dm.receiver_id = ?)
        `;
        const params = [selfId, userId, userId, selfId];

        if (before) {
            const beforeId = parseInt(before);
            if (!isNaN(beforeId)) {
                sqlQuery += ` AND dm.message_id < ?`;
                params.push(beforeId);
            }
        }

        sqlQuery += ` ORDER BY dm.created_at DESC LIMIT ${messageLimit}`;

        console.log('DEBUG: messageLimit =', messageLimit, 'SQL:', sqlQuery.substring(sqlQuery.length - 100));
        console.log('DEBUG: params =', JSON.stringify(params));

        const messages = await query(sqlQuery, params);

        // Get reactions for all messages
        const messageIds = messages.map(m => m.message_id);
        let reactions = [];
        if (messageIds.length > 0) {
            reactions = await query(
                `SELECT mr.*, u.username, u.display_name, u.profile_image_url
                 FROM MessageReactions mr
                 JOIN Users u ON mr.user_id = u.user_id
                 WHERE mr.message_id IN (?) AND mr.message_type = 'dm'`,
                [messageIds]
            );
        }

        // Attach reactions to messages
        const messagesWithReactions = messages.map(msg => ({
            ...msg,
            reactions: reactions.filter(r => r.message_id === msg.message_id)
        }));

        // Mark messages as read
        await query(
            `UPDATE DirectMessages
             SET is_read = TRUE
             WHERE sender_id = ? AND receiver_id = ?`,
            [userId, selfId]
        );

        res.json({ 
            success: true, 
            messages: messagesWithReactions.reverse() // Return in chronological order
        });
    } catch (error) {
        console.error("DM Fetch Error:", error);
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});

/**
 * Get all DM conversations for the authenticated user
 * GET /api/direct/conversations
 */
router.get('/conversations', authenticateToken, async (req, res) => {
    const userId = req.user.user_id;

    try {
        const rows = await query(
            `
            SELECT 
                CASE 
                    WHEN sender_id = ? THEN receiver_id
                    ELSE sender_id
                END AS other_user_id,
                MAX(created_at) AS last_message_time,
                SUM(CASE WHEN receiver_id = ? AND is_read = FALSE THEN 1 ELSE 0 END) AS unread_count
            FROM DirectMessages
            WHERE sender_id = ? OR receiver_id = ?
            GROUP BY other_user_id
            ORDER BY last_message_time DESC
            `,
            [userId, userId, userId, userId]
        );

        // Get user info for each other_user_id
        const formatted = [];
        for (let conv of rows) {
            const user = await query(
                `SELECT user_id, display_name, profile_image_url FROM Users WHERE user_id = ?`,
                [conv.other_user_id]
            );

            formatted.push({
                user: user[0] || null,
                last_message_time: conv.last_message_time,
                unread_count: conv.unread_count
            });
        }

        res.json({ success: true, conversations: formatted });
    } catch (error) {
        console.error("DM Conversations Error:", error);
        res.status(500).json({ error: "Failed to load conversations" });
    }
});

/**
 * Get total unread DM count
 * GET /api/direct/unread/count
 */
router.get('/unread/count', authenticateToken, async (req, res) => {
    const userId = req.user.user_id;

    try {
        const count = await query(
            `SELECT COUNT(*) AS unread
             FROM DirectMessages
             WHERE receiver_id = ? AND is_read = FALSE`,
            [userId]
        );

        res.json({ success: true, unread: count[0].unread });
    } catch (error) {
        console.error("DM Unread Count Error:", error);
        res.status(500).json({ error: "Failed to get unread count" });
    }
});

/**
 * Edit a direct message (15 minute window, text only)
 * PATCH /api/direct/messages/:messageId
 */
router.patch('/messages/:messageId', authenticateToken, async (req, res) => {
    const messageId = parseInt(req.params.messageId);
    const userId = req.user.user_id;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Content is required" });
    }

    try {
        // Get message and verify ownership
        const message = await query(
            `SELECT * FROM DirectMessages WHERE message_id = ? AND sender_id = ?`,
            [messageId, userId]
        );

        if (message.length === 0) {
            return res.status(404).json({ error: "Message not found or not authorized" });
        }

        // Check if message has media (can't edit media messages)
        if (message[0].media_url) {
            return res.status(400).json({ error: "Cannot edit messages with media" });
        }

        // Check if within 15 minute window
        const messageTime = new Date(message[0].created_at);
        const now = new Date();
        const diffMinutes = (now - messageTime) / 1000 / 60;

        if (diffMinutes > 15) {
            return res.status(400).json({ error: "Can only edit messages within 15 minutes of sending" });
        }

        // Update message
        await query(
            `UPDATE DirectMessages 
             SET content = ?, is_edited = TRUE, edited_at = CURRENT_TIMESTAMP 
             WHERE message_id = ?`,
            [content, messageId]
        );

        // Get updated message
        const updatedMessage = await query(
            `SELECT dm.*,
                    u.display_name as sender_name,
                    u.username as sender_username,
                    u.profile_image_url as sender_image
             FROM DirectMessages dm
             INNER JOIN Users u ON dm.sender_id = u.user_id
             WHERE dm.message_id = ?`,
            [messageId]
        );

        res.json({ success: true, message: updatedMessage[0] });
    } catch (error) {
        console.error("Edit message error:", error);
        res.status(500).json({ error: "Failed to edit message" });
    }
});

/**
 * Mark specific message as read
 * PATCH /api/direct/messages/:messageId/read
 */
router.patch('/messages/:messageId/read', authenticateToken, async (req, res) => {
    const messageId = parseInt(req.params.messageId);
    const userId = req.user.user_id;

    try {
        // Verify user is the receiver
        const message = await query(
            `SELECT * FROM DirectMessages WHERE message_id = ? AND receiver_id = ?`,
            [messageId, userId]
        );

        if (message.length === 0) {
            return res.status(404).json({ error: "Message not found or not authorized" });
        }

        await query(
            `UPDATE DirectMessages SET is_read = TRUE WHERE message_id = ?`,
            [messageId]
        );

        res.json({ success: true, message: "Message marked as read" });
    } catch (error) {
        console.error("Mark read error:", error);
        res.status(500).json({ error: "Failed to mark message as read" });
    }
});

/**
 * Delete a message (only sender can delete)
 * DELETE /api/direct/messages/:messageId
 */
router.delete('/messages/:messageId', authenticateToken, async (req, res) => {
    const messageId = parseInt(req.params.messageId);
    const userId = req.user.user_id;

    try {
        // Check if user is the sender
        const message = await query(
            `SELECT * FROM DirectMessages WHERE message_id = ? AND sender_id = ?`,
            [messageId, userId]
        );

        if (message.length === 0) {
            return res.status(404).json({ error: "Message not found or not authorized" });
        }

        await query(
            `DELETE FROM DirectMessages WHERE message_id = ?`,
            [messageId]
        );

        res.json({ success: true, message: "Message deleted" });
    } catch (error) {
        console.error("Delete message error:", error);
        res.status(500).json({ error: "Failed to delete message" });
    }
});

/**
 * Search messages with a user
 * GET /api/direct/messages/:userId/search?q=query
 */
router.get('/messages/:userId/search', authenticateToken, async (req, res) => {
    const userId = parseInt(req.params.userId);
    const selfId = req.user.user_id;
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
    }

    try {
        const messages = await query(
            `SELECT dm.*,
                    u.display_name as sender_name,
                    u.username as sender_username,
                    u.profile_image_url as sender_image
             FROM DirectMessages dm
             INNER JOIN Users u ON dm.sender_id = u.user_id
             WHERE ((dm.sender_id = ? AND dm.receiver_id = ?)
                OR (dm.sender_id = ? AND dm.receiver_id = ?))
               AND dm.content LIKE ?
             ORDER BY dm.created_at DESC
             LIMIT 50`,
            [selfId, userId, userId, selfId, `%${q}%`]
        );

        res.json({ success: true, messages });
    } catch (error) {
        console.error("Search messages error:", error);
        res.status(500).json({ error: "Failed to search messages" });
    }
});

/**
 * Get user online status (last seen)
 * GET /api/direct/user/:userId/status
 */
router.get('/user/:userId/status', authenticateToken, async (req, res) => {
    const userId = parseInt(req.params.userId);

    try {
        const user = await query(
            `SELECT last_login, display_name FROM Users WHERE user_id = ?`,
            [userId]
        );

        if (user.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        // Consider online if logged in within last 5 minutes
        const isOnline = user[0].last_login && 
            (new Date() - new Date(user[0].last_login)) < 5 * 60 * 1000;

        res.json({
            success: true,
            user_id: userId,
            display_name: user[0].display_name,
            is_online: isOnline,
            last_seen: user[0].last_login
        });
    } catch (error) {
        console.error("Get status error:", error);
        res.status(500).json({ error: "Failed to get user status" });
    }
});

/**
 * React to a direct message
 * POST /api/direct/messages/:messageId/react
 */
router.post('/messages/:messageId/react', authenticateToken, async (req, res) => {
    const messageId = parseInt(req.params.messageId);
    const userId = req.user.user_id;
    const { emoji } = req.body;

    if (!emoji) {
        return res.status(400).json({ error: 'Emoji is required' });
    }

    try {
        // Verify message exists and user has access
        const messages = await query(
            'SELECT * FROM DirectMessages WHERE message_id = ? AND (sender_id = ? OR receiver_id = ?)',
            [messageId, userId, userId]
        );

        if (messages.length === 0) {
            return res.status(404).json({ error: 'Message not found or access denied' });
        }

        // Add reaction (will replace if already exists due to unique constraint)
        await query(
            `INSERT INTO MessageReactions (message_id, message_type, user_id, emoji) 
             VALUES (?, 'dm', ?, ?)
             ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP`,
            [messageId, userId, emoji]
        );

        // Get all reactions for this message
        const reactions = await query(
            `SELECT mr.*, u.username, u.display_name, u.profile_image_url
             FROM MessageReactions mr
             JOIN Users u ON mr.user_id = u.user_id
             WHERE mr.message_id = ? AND mr.message_type = 'dm'
             ORDER BY mr.created_at`,
            [messageId]
        );

        res.json({
            success: true,
            reactions: reactions
        });
    } catch (error) {
        console.error('Error adding reaction:', error);
        res.status(500).json({ error: 'Failed to add reaction' });
    }
});

module.exports = router;
