const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth.middleware');
const { validateGroupCreation, validateMessage } = require('../utils/validation');
const crypto = require('crypto');

/**
 * Create a new group
 * POST /api/groups/create
 */
router.post('/create', authenticateToken, async (req, res) => {
    const { name, description, group_type, street_name, is_private } = req.body;
    const created_by = req.user.user_id;

    const validation = validateGroupCreation({ name, group_type });
    if (!validation.isValid) {
        return res.status(400).json({ error: validation.errors.join(', ') });
    }

    try {
        // Create the group
        const [result] = await pool.query(
            `INSERT INTO UserGroups (name, description, group_type, street_name, is_private, created_by, member_count)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [name, description || null, group_type || 'interest', street_name || null, is_private !== false, created_by]
        );

        const groupId = result.insertId;

        // Add creator as admin
        await pool.query(
            `INSERT INTO GroupMemberships (group_id, user_id, role, status)
             VALUES (?, ?, 'admin', 'active')`,
            [groupId, created_by]
        );

        res.status(201).json({ 
            success: true, 
            message: 'Group created successfully',
            group_id: groupId 
        });
    } catch (error) {
        console.error('Group creation error:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
});

/**
 * Get user's groups
 * GET /api/groups/my-groups
 */
router.get('/my-groups', authenticateToken, async (req, res) => {
    const userId = req.user.user_id;

    try {
        const [groups] = await pool.query(
            `SELECT 
                g.group_id,
                g.name,
                g.description,
                g.group_type,
                g.street_name,
                g.is_private,
                g.member_count,
                g.created_at,
                gm.role,
                u.display_name as creator_name,
                (SELECT COUNT(*) FROM ChatMessages WHERE group_id = g.group_id AND is_read = FALSE) as unread_count
             FROM UserGroups g
             INNER JOIN GroupMemberships gm ON g.group_id = gm.group_id
             LEFT JOIN Users u ON g.created_by = u.user_id
             WHERE gm.user_id = ? AND gm.status = 'active'
             ORDER BY g.created_at DESC`,
            [userId]
        );

        res.json({ success: true, groups });
    } catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
});

/**
 * Get group details
 * GET /api/groups/:groupId
 */
router.get('/:groupId', authenticateToken, async (req, res) => {
    const groupId = parseInt(req.params.groupId);
    const userId = req.user.user_id;

    try {
        // Check if user is a member
        const [membership] = await pool.query(
            `SELECT * FROM GroupMemberships 
             WHERE group_id = ? AND user_id = ? AND status = 'active'`,
            [groupId, userId]
        );

        if (membership.length === 0) {
            return res.status(403).json({ error: 'Not a member of this group' });
        }

        // Get group details
        const [group] = await pool.query(
            `SELECT 
                g.*,
                u.display_name as creator_name,
                u.profile_image_url as creator_image
             FROM UserGroups g
             LEFT JOIN Users u ON g.created_by = u.user_id
             WHERE g.group_id = ?`,
            [groupId]
        );

        if (group.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Get members
        const [members] = await pool.query(
            `SELECT 
                gm.membership_id,
                gm.role,
                gm.joined_at,
                u.user_id,
                u.display_name,
                u.username,
                u.profile_image_url
             FROM GroupMemberships gm
             INNER JOIN Users u ON gm.user_id = u.user_id
             WHERE gm.group_id = ? AND gm.status = 'active'
             ORDER BY gm.role, u.display_name`,
            [groupId]
        );

        res.json({ 
            success: true, 
            group: {
                ...group[0],
                members,
                user_role: membership[0].role
            }
        });
    } catch (error) {
        console.error('Get group details error:', error);
        res.status(500).json({ error: 'Failed to fetch group details' });
    }
});

/**
 * Send a message to a group
 * POST /api/groups/:groupId/messages
 */
router.post('/:groupId/messages', authenticateToken, async (req, res) => {
    const groupId = parseInt(req.params.groupId);
    const userId = req.user.user_id;
    const { content, message_type, media_url } = req.body;

    const validation = validateMessage({ content });
    if (!validation.isValid) {
        return res.status(400).json({ error: validation.errors.join(', ') });
    }

    try {
        // Check if user is a member
        const [membership] = await pool.query(
            `SELECT * FROM GroupMemberships 
             WHERE group_id = ? AND user_id = ? AND status = 'active'`,
            [groupId, userId]
        );

        if (membership.length === 0) {
            return res.status(403).json({ error: 'Not a member of this group' });
        }

        // Insert message
        const [result] = await pool.query(
            `INSERT INTO ChatMessages (group_id, user_id, content, message_type, media_url)
             VALUES (?, ?, ?, ?, ?)`,
            [groupId, userId, content, message_type || 'text', media_url || null]
        );

        // Get the created message with user info
        const [message] = await pool.query(
            `SELECT 
                cm.*,
                u.display_name,
                u.username,
                u.profile_image_url
             FROM ChatMessages cm
             INNER JOIN Users u ON cm.user_id = u.user_id
             WHERE cm.message_id = ?`,
            [result.insertId]
        );

        // Create notifications for other members (optional - can be done async)
        await pool.query(
            `INSERT INTO Notifications (user_id, type, title, content, related_id, related_type)
             SELECT gm.user_id, 'message', ?, ?, ?, 'group'
             FROM GroupMemberships gm
             WHERE gm.group_id = ? AND gm.user_id != ? AND gm.status = 'active'`,
            ['New Group Message', content.slice(0, 100), groupId, groupId, userId]
        );

        res.status(201).json({ 
            success: true, 
            message: message[0]
        });
    } catch (error) {
        console.error('Send group message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

/**
 * Get messages from a group
 * GET /api/groups/:groupId/messages
 */
router.get('/:groupId/messages', authenticateToken, async (req, res) => {
    const groupId = parseInt(req.params.groupId);
    const userId = req.user.user_id;
    const { limit = 50, before } = req.query;

    try {
        // Check if user is a member
        const [membership] = await pool.query(
            `SELECT * FROM GroupMemberships 
             WHERE group_id = ? AND user_id = ? AND status = 'active'`,
            [groupId, userId]
        );

        if (membership.length === 0) {
            return res.status(403).json({ error: 'Not a member of this group' });
        }

        // Build query
        let query = `
            SELECT 
                cm.*,
                u.display_name,
                u.username,
                u.profile_image_url
            FROM ChatMessages cm
            INNER JOIN Users u ON cm.user_id = u.user_id
            WHERE cm.group_id = ?
        `;
        const params = [groupId];

        if (before) {
            query += ` AND cm.message_id < ?`;
            params.push(before);
        }

        query += ` ORDER BY cm.created_at DESC LIMIT ?`;
        params.push(parseInt(limit));

        const [messages] = await pool.query(query, params);

        // Mark messages as read
        await pool.query(
            `UPDATE ChatMessages 
             SET is_read = TRUE 
             WHERE group_id = ? AND user_id != ?`,
            [groupId, userId]
        );

        res.json({ 
            success: true, 
            messages: messages.reverse() // Return in chronological order
        });
    } catch (error) {
        console.error('Get group messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

/**
 * Add member to group
 * POST /api/groups/:groupId/members
 */
router.post('/:groupId/members', authenticateToken, async (req, res) => {
    const groupId = parseInt(req.params.groupId);
    const userId = req.user.user_id;
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ error: 'user_id is required' });
    }

    try {
        // Check if requester is admin or moderator
        const [membership] = await pool.query(
            `SELECT role FROM GroupMemberships 
             WHERE group_id = ? AND user_id = ? AND status = 'active'`,
            [groupId, userId]
        );

        if (membership.length === 0 || !['admin', 'moderator'].includes(membership[0].role)) {
            return res.status(403).json({ error: 'Only admins and moderators can add members' });
        }

        // Check if user exists
        const [user] = await pool.query(
            `SELECT user_id FROM Users WHERE user_id = ?`,
            [user_id]
        );

        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if already a member
        const [existing] = await pool.query(
            `SELECT * FROM GroupMemberships WHERE group_id = ? AND user_id = ?`,
            [groupId, user_id]
        );

        if (existing.length > 0) {
            if (existing[0].status === 'active') {
                return res.status(400).json({ error: 'User is already a member' });
            }
            // Reactivate if previously removed
            await pool.query(
                `UPDATE GroupMemberships SET status = 'active' WHERE group_id = ? AND user_id = ?`,
                [groupId, user_id]
            );
        } else {
            // Add new member
            await pool.query(
                `INSERT INTO GroupMemberships (group_id, user_id, role, status)
                 VALUES (?, ?, 'member', 'active')`,
                [groupId, user_id]
            );
        }

        // Update member count
        await pool.query(
            `UPDATE UserGroups 
             SET member_count = (SELECT COUNT(*) FROM GroupMemberships WHERE group_id = ? AND status = 'active')
             WHERE group_id = ?`,
            [groupId, groupId]
        );

        // Send notification
        await pool.query(
            `INSERT INTO Notifications (user_id, type, title, content, related_id, related_type)
             VALUES (?, 'message', 'Added to Group', 'You were added to a group', ?, 'group')`,
            [user_id, groupId]
        );

        res.json({ success: true, message: 'Member added successfully' });
    } catch (error) {
        console.error('Add member error:', error);
        res.status(500).json({ error: 'Failed to add member' });
    }
});

/**
 * Invite a user to a group
 * POST /api/groups/:groupId/invite
 * Body: { user_id }
 */
router.post('/:groupId/invite', authenticateToken, async (req, res) => {
    const groupId = parseInt(req.params.groupId);
    const inviterId = req.user.user_id;
    const { user_id } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    try {
        // Check inviter role (admin/mod)
        const [inviterMembership] = await pool.query(
            `SELECT role FROM GroupMemberships WHERE group_id = ? AND user_id = ? AND status = 'active'`,
            [groupId, inviterId]
        );

        if (inviterMembership.length === 0 || !['admin', 'moderator'].includes(inviterMembership[0].role)) {
            return res.status(403).json({ error: 'Only admins and moderators can invite users' });
        }

        // Check target user exists
        const [target] = await pool.query(`SELECT user_id FROM Users WHERE user_id = ?`, [user_id]);
        if (target.length === 0) return res.status(404).json({ error: 'User not found' });

        // Check membership status
        const [existing] = await pool.query(`SELECT * FROM GroupMemberships WHERE group_id = ? AND user_id = ?`, [groupId, user_id]);

        // generate invite id
        const inviteId = crypto.randomBytes(10).toString('hex');

        if (existing.length > 0) {
            const row = existing[0];
            if (row.status === 'active') {
                return res.status(400).json({ error: 'User is already a member' });
            }
            if (row.status === 'invited') {
                // already invited
                return res.json({ success: true, invite_id: row.invite_id || null, message: 'User already invited' });
            }

            // Reactivate as invited
            await pool.query(
                `UPDATE GroupMemberships SET status = 'invited', invited_by = ?, invite_created_at = NOW(), invite_id = ? WHERE group_id = ? AND user_id = ?`,
                [inviterId, inviteId, groupId, user_id]
            );
        } else {
            await pool.query(
                `INSERT INTO GroupMemberships (group_id, user_id, role, status, invited_by, invite_created_at, invite_id)
                 VALUES (?, ?, 'member', 'invited', ?, NOW(), ?)`,
                [groupId, user_id, inviterId, inviteId]
            );
        }

        // Send notification to invited user
        await pool.query(
            `INSERT INTO Notifications (user_id, type, title, content, related_id, related_type)
             VALUES (?, 'group_invite', 'Group Invitation', ?, ?, 'group')`,
            [user_id, `You've been invited to join group ${groupId}`, groupId]
        );

        res.status(201).json({ success: true, invite_id: inviteId });
    } catch (error) {
        console.error('Invite user error:', error);
        res.status(500).json({ error: 'Failed to invite user' });
    }
});

/**
 * List invites for authenticated user
 * GET /api/groups/invites
 */
router.get('/invites', authenticateToken, async (req, res) => {
    const userId = req.user.user_id;

    try {
        const [invites] = await pool.query(
            `SELECT gm.invite_id, gm.group_id, g.name as group_name, gm.invited_by, u.display_name as invited_by_name, gm.invite_created_at
             FROM GroupMemberships gm
             LEFT JOIN UserGroups g ON g.group_id = gm.group_id
             LEFT JOIN Users u ON u.user_id = gm.invited_by
             WHERE gm.user_id = ? AND gm.status = 'invited'
             ORDER BY gm.invite_created_at DESC`,
            [userId]
        );

        res.json({ success: true, invites });
    } catch (error) {
        console.error('List invites error:', error);
        res.status(500).json({ error: 'Failed to load invites' });
    }
});

/**
 * Accept invite
 * POST /api/groups/:groupId/invites/:inviteId/accept
 */
router.post('/:groupId/invites/:inviteId/accept', authenticateToken, async (req, res) => {
    const groupId = parseInt(req.params.groupId);
    const inviteId = req.params.inviteId;
    const userId = req.user.user_id;

    try {
        const [rows] = await pool.query(`SELECT * FROM GroupMemberships WHERE group_id = ? AND user_id = ? AND invite_id = ?`, [groupId, userId, inviteId]);
        if (rows.length === 0 || rows[0].status !== 'invited') {
            return res.status(404).json({ error: 'Invite not found' });
        }

        // Accept: set active
        await pool.query(`UPDATE GroupMemberships SET status = 'active', joined_at = NOW(), invite_id = NULL, invited_by = NULL, invite_created_at = NULL WHERE group_id = ? AND user_id = ?`, [groupId, userId]);

        // Update member count
        await pool.query(
            `UPDATE UserGroups SET member_count = (SELECT COUNT(*) FROM GroupMemberships WHERE group_id = ? AND status = 'active') WHERE group_id = ?`,
            [groupId, groupId]
        );

        // Notify inviter (optional)
        const inviter = rows[0].invited_by;
        if (inviter) {
            await pool.query(
                `INSERT INTO Notifications (user_id, type, title, content, related_id, related_type)
                 VALUES (?, 'group', 'Invite Accepted', ?, ?, 'group')`,
                [inviter, `User ${userId} accepted your invite to group ${groupId}`, groupId]
            );
        }

        res.json({ success: true, message: 'Joined group' });
    } catch (error) {
        console.error('Accept invite error:', error);
        res.status(500).json({ error: 'Failed to accept invite' });
    }
});

/**
 * Reject invite
 * POST /api/groups/:groupId/invites/:inviteId/reject
 */
router.post('/:groupId/invites/:inviteId/reject', authenticateToken, async (req, res) => {
    const groupId = parseInt(req.params.groupId);
    const inviteId = req.params.inviteId;
    const userId = req.user.user_id;

    try {
        const [rows] = await pool.query(`SELECT * FROM GroupMemberships WHERE group_id = ? AND user_id = ? AND invite_id = ?`, [groupId, userId, inviteId]);
        if (rows.length === 0 || rows[0].status !== 'invited') {
            return res.status(404).json({ error: 'Invite not found' });
        }

        await pool.query(`UPDATE GroupMemberships SET status = 'rejected', invite_id = NULL WHERE group_id = ? AND user_id = ?`, [groupId, userId]);

        res.json({ success: true, message: 'Invite rejected' });
    } catch (error) {
        console.error('Reject invite error:', error);
        res.status(500).json({ error: 'Failed to reject invite' });
    }
});

/**
 * Remove member from group
 * DELETE /api/groups/:groupId/members/:userId
 */
router.delete('/:groupId/members/:memberId', authenticateToken, async (req, res) => {
    const groupId = parseInt(req.params.groupId);
    const memberId = parseInt(req.params.memberId);
    const userId = req.user.user_id;

    try {
        // Check if requester is admin
        const [membership] = await pool.query(
            `SELECT role FROM GroupMemberships 
             WHERE group_id = ? AND user_id = ? AND status = 'active'`,
            [groupId, userId]
        );

        // Allow users to leave themselves, or admins to remove others
        const isAdmin = membership.length > 0 && membership[0].role === 'admin';
        const isSelf = userId === memberId;

        if (!isAdmin && !isSelf) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        // Remove member
        await pool.query(
            `UPDATE GroupMemberships 
             SET status = 'removed' 
             WHERE group_id = ? AND user_id = ?`,
            [groupId, memberId]
        );

        // Update member count
        await pool.query(
            `UPDATE UserGroups 
             SET member_count = (SELECT COUNT(*) FROM GroupMemberships WHERE group_id = ? AND status = 'active')
             WHERE group_id = ?`,
            [groupId, groupId]
        );

        res.json({ success: true, message: 'Member removed successfully' });
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ error: 'Failed to remove member' });
    }
});

/**
 * Update member role
 * PATCH /api/groups/:groupId/members/:userId/role
 */
router.patch('/:groupId/members/:memberId/role', authenticateToken, async (req, res) => {
    const groupId = parseInt(req.params.groupId);
    const memberId = parseInt(req.params.memberId);
    const userId = req.user.user_id;
    const { role } = req.body;

    if (!['admin', 'moderator', 'member'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    try {
        // Check if requester is admin
        const [membership] = await pool.query(
            `SELECT role FROM GroupMemberships 
             WHERE group_id = ? AND user_id = ? AND status = 'active'`,
            [groupId, userId]
        );

        if (membership.length === 0 || membership[0].role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can change roles' });
        }

        // Update role
        await pool.query(
            `UPDATE GroupMemberships 
             SET role = ? 
             WHERE group_id = ? AND user_id = ?`,
            [role, groupId, memberId]
        );

        res.json({ success: true, message: 'Role updated successfully' });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Failed to update role' });
    }
});

/**
 * Delete a message (admin/moderator or message author)
 * DELETE /api/groups/:groupId/messages/:messageId
 */
router.delete('/:groupId/messages/:messageId', authenticateToken, async (req, res) => {
    const groupId = parseInt(req.params.groupId);
    const messageId = parseInt(req.params.messageId);
    const userId = req.user.user_id;

    try {
        // Get message and user's role
        const [message] = await pool.query(
            `SELECT cm.user_id as message_author
             FROM ChatMessages cm
             WHERE cm.message_id = ? AND cm.group_id = ?`,
            [messageId, groupId]
        );

        if (message.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        const [membership] = await pool.query(
            `SELECT role FROM GroupMemberships 
             WHERE group_id = ? AND user_id = ? AND status = 'active'`,
            [groupId, userId]
        );

        const isAuthor = message[0].message_author === userId;
        const isModerator = membership.length > 0 && ['admin', 'moderator'].includes(membership[0].role);

        if (!isAuthor && !isModerator) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        // Delete message
        await pool.query(
            `DELETE FROM ChatMessages WHERE message_id = ?`,
            [messageId]
        );

        res.json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

/**
 * Leave a group
 * POST /api/groups/:groupId/leave
 */
router.post('/:groupId/leave', authenticateToken, async (req, res) => {
    const groupId = parseInt(req.params.groupId);
    const userId = req.user.user_id;

    try {
        // Check if user is the only admin
        const [admins] = await pool.query(
            `SELECT COUNT(*) as admin_count 
             FROM GroupMemberships 
             WHERE group_id = ? AND role = 'admin' AND status = 'active'`,
            [groupId]
        );

        const [userMembership] = await pool.query(
            `SELECT role FROM GroupMemberships 
             WHERE group_id = ? AND user_id = ? AND status = 'active'`,
            [groupId, userId]
        );

        if (userMembership.length > 0 && userMembership[0].role === 'admin' && admins[0].admin_count === 1) {
            return res.status(400).json({ 
                error: 'Cannot leave: you are the only admin. Promote another member first or delete the group.' 
            });
        }

        // Remove user from group
        await pool.query(
            `UPDATE GroupMemberships 
             SET status = 'removed' 
             WHERE group_id = ? AND user_id = ?`,
            [groupId, userId]
        );

        // Update member count
        await pool.query(
            `UPDATE UserGroups 
             SET member_count = (SELECT COUNT(*) FROM GroupMemberships WHERE group_id = ? AND status = 'active')
             WHERE group_id = ?`,
            [groupId, groupId]
        );

        res.json({ success: true, message: 'Left group successfully' });
    } catch (error) {
        console.error('Leave group error:', error);
        res.status(500).json({ error: 'Failed to leave group' });
    }
});

module.exports = router;
