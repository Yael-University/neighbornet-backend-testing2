const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth.middleware');
const { validateDirectMessage } = require('../utils/validation');

/**
 * Send a direct message to another user
 * POST /api/direct/send
 */
router.post('/send', authenticateToken, async (req, res) => {
    const { receiver_id, content, media_url } = req.body;
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
        const [receiver] = await pool.query(
            `SELECT user_id FROM Users WHERE user_id = ?`,
            [receiver_id]
        );

        if (receiver.length === 0) {
            return res.status(404).json({ error: "Receiver not found" });
        }

        // Insert message
        const [result] = await pool.query(
            `INSERT INTO DirectMessages (sender_id, receiver_id, content, media_url)
             VALUES (?, ?, ?, ?)`,
            [sender_id, receiver_id, content, media_url || null]
        );

        // Get the created message
        const [message] = await pool.query(
            `SELECT 
                dm.*,
                u.display_name as sender_name,
                u.username as sender_username,
                u.profile_image_url as sender_image
             FROM DirectMessages dm
             INNER JOIN Users u ON dm.sender_id = u.user_id
             WHERE dm.message_id = ?`,
            [result.insertId]
        );

        // Create a notification
        await pool.query(
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
 * Get all messages between the authenticated user and another user
 * GET /api/direct/messages/:userId
 */
router.get('/messages/:userId', authenticateToken, async (req, res) => {
    const userId = parseInt(req.params.userId);
    const selfId = req.user.user_id;

    try {
        const [messages] = await pool.query(
            `SELECT * FROM DirectMessages
             WHERE (sender_id = ? AND receiver_id = ?)
                OR (sender_id = ? AND receiver_id = ?)
             ORDER BY created_at ASC`,
            [selfId, userId, userId, selfId]
        );

        // Mark messages as read
        await pool.query(
            `UPDATE DirectMessages
             SET is_read = TRUE
             WHERE sender_id = ? AND receiver_id = ?`,
            [userId, selfId]
        );

        res.json({ success: true, messages });
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
        const [rows] = await pool.query(
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
            const [user] = await pool.query(
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
 * GET /api/direct/unread
 */
router.get('/unread/count', authenticateToken, async (req, res) => {
    const userId = req.user.user_id;

    try {
        const [[count]] = await pool.query(
            `SELECT COUNT(*) AS unread
             FROM DirectMessages
             WHERE receiver_id = ? AND is_read = FALSE`,
            [userId]
        );

        res.json({ success: true, unread: count.unread });
    } catch (error) {
        console.error("DM Unread Count Error:", error);
        res.status(500).json({ error: "Failed to get unread count" });
    }
});

module.exports = router;
