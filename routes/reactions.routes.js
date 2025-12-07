const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Add reaction to direct message
router.post('/direct/messages/:messageId/react', async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.user_id;
    
    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required' });
    }
    
    // Verify message exists and user has access
    const [messages] = await connection.query(
      'SELECT * FROM DirectMessages WHERE message_id = ? AND (sender_id = ? OR receiver_id = ?)',
      [messageId, userId, userId]
    );
    
    if (messages.length === 0) {
      return res.status(404).json({ error: 'Message not found or access denied' });
    }
    
    // Add reaction (will replace if already exists due to unique constraint)
    await connection.query(
      `INSERT INTO MessageReactions (message_id, message_type, user_id, emoji) 
       VALUES (?, 'dm', ?, ?)
       ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP`,
      [messageId, userId, emoji]
    );
    
    // Get all reactions for this message
    const [reactions] = await connection.query(
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
  } finally {
    connection.release();
  }
});

// Remove reaction from direct message
router.delete('/direct/messages/:messageId/react/:emoji', async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { messageId, emoji } = req.params;
    const userId = req.user.user_id;
    
    // Verify message exists and user has access
    const [messages] = await connection.query(
      'SELECT * FROM DirectMessages WHERE message_id = ? AND (sender_id = ? OR receiver_id = ?)',
      [messageId, userId, userId]
    );
    
    if (messages.length === 0) {
      return res.status(404).json({ error: 'Message not found or access denied' });
    }
    
    // Remove reaction
    const [result] = await connection.query(
      `DELETE FROM MessageReactions 
       WHERE message_id = ? AND message_type = 'dm' AND user_id = ? AND emoji = ?`,
      [messageId, userId, emoji]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Reaction not found' });
    }
    
    // Get remaining reactions
    const [reactions] = await connection.query(
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
    console.error('Error removing reaction:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  } finally {
    connection.release();
  }
});

// Get all reactions for a direct message
router.get('/direct/messages/:messageId/reactions', async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { messageId } = req.params;
    const userId = req.user.user_id;
    
    // Verify message exists and user has access
    const [messages] = await connection.query(
      'SELECT * FROM DirectMessages WHERE message_id = ? AND (sender_id = ? OR receiver_id = ?)',
      [messageId, userId, userId]
    );
    
    if (messages.length === 0) {
      return res.status(404).json({ error: 'Message not found or access denied' });
    }
    
    // Get all reactions
    const [reactions] = await connection.query(
      `SELECT mr.*, u.username, u.display_name, u.profile_image_url
       FROM MessageReactions mr
       JOIN Users u ON mr.user_id = u.user_id
       WHERE mr.message_id = ? AND mr.message_type = 'dm'
       ORDER BY mr.created_at`,
      [messageId]
    );
    
    // Group by emoji
    const reactionsByEmoji = {};
    reactions.forEach(reaction => {
      if (!reactionsByEmoji[reaction.emoji]) {
        reactionsByEmoji[reaction.emoji] = [];
      }
      reactionsByEmoji[reaction.emoji].push({
        user_id: reaction.user_id,
        username: reaction.username,
        display_name: reaction.display_name,
        profile_image_url: reaction.profile_image_url,
        created_at: reaction.created_at
      });
    });
    
    res.json({
      success: true,
      reactions: reactions,
      reactions_by_emoji: reactionsByEmoji
    });
    
  } catch (error) {
    console.error('Error getting reactions:', error);
    res.status(500).json({ error: 'Failed to get reactions' });
  } finally {
    connection.release();
  }
});

// Add reaction to group message
router.post('/groups/:groupId/messages/:messageId/react', async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { groupId, messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.user_id;
    
    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required' });
    }
    
    // Verify user is member of group
    const [memberships] = await connection.query(
      'SELECT * FROM GroupMemberships WHERE group_id = ? AND user_id = ? AND status = "active"',
      [groupId, userId]
    );
    
    if (memberships.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }
    
    // Verify message exists in this group
    const [messages] = await connection.query(
      'SELECT * FROM ChatMessages WHERE message_id = ? AND group_id = ?',
      [messageId, groupId]
    );
    
    if (messages.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Add reaction
    await connection.query(
      `INSERT INTO MessageReactions (message_id, message_type, user_id, emoji) 
       VALUES (?, 'group', ?, ?)
       ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP`,
      [messageId, userId, emoji]
    );
    
    // Get all reactions for this message
    const [reactions] = await connection.query(
      `SELECT mr.*, u.username, u.display_name, u.profile_image_url
       FROM MessageReactions mr
       JOIN Users u ON mr.user_id = u.user_id
       WHERE mr.message_id = ? AND mr.message_type = 'group'
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
  } finally {
    connection.release();
  }
});

// Remove reaction from group message
router.delete('/groups/:groupId/messages/:messageId/react/:emoji', async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { groupId, messageId, emoji } = req.params;
    const userId = req.user.user_id;
    
    // Verify user is member of group
    const [memberships] = await connection.query(
      'SELECT * FROM GroupMemberships WHERE group_id = ? AND user_id = ? AND status = "active"',
      [groupId, userId]
    );
    
    if (memberships.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }
    
    // Verify message exists in this group
    const [messages] = await connection.query(
      'SELECT * FROM ChatMessages WHERE message_id = ? AND group_id = ?',
      [messageId, groupId]
    );
    
    if (messages.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Remove reaction
    const [result] = await connection.query(
      `DELETE FROM MessageReactions 
       WHERE message_id = ? AND message_type = 'group' AND user_id = ? AND emoji = ?`,
      [messageId, userId, emoji]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Reaction not found' });
    }
    
    // Get remaining reactions
    const [reactions] = await connection.query(
      `SELECT mr.*, u.username, u.display_name, u.profile_image_url
       FROM MessageReactions mr
       JOIN Users u ON mr.user_id = u.user_id
       WHERE mr.message_id = ? AND mr.message_type = 'group'
       ORDER BY mr.created_at`,
      [messageId]
    );
    
    res.json({
      success: true,
      reactions: reactions
    });
    
  } catch (error) {
    console.error('Error removing reaction:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  } finally {
    connection.release();
  }
});

// Get all reactions for a group message
router.get('/groups/:groupId/messages/:messageId/reactions', async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { groupId, messageId } = req.params;
    const userId = req.user.user_id;
    
    // Verify user is member of group
    const [memberships] = await connection.query(
      'SELECT * FROM GroupMemberships WHERE group_id = ? AND user_id = ? AND status = "active"',
      [groupId, userId]
    );
    
    if (memberships.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }
    
    // Verify message exists in this group
    const [messages] = await connection.query(
      'SELECT * FROM ChatMessages WHERE message_id = ? AND group_id = ?',
      [messageId, groupId]
    );
    
    if (messages.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Get all reactions
    const [reactions] = await connection.query(
      `SELECT mr.*, u.username, u.display_name, u.profile_image_url
       FROM MessageReactions mr
       JOIN Users u ON mr.user_id = u.user_id
       WHERE mr.message_id = ? AND mr.message_type = 'group'
       ORDER BY mr.created_at`,
      [messageId]
    );
    
    // Group by emoji
    const reactionsByEmoji = {};
    reactions.forEach(reaction => {
      if (!reactionsByEmoji[reaction.emoji]) {
        reactionsByEmoji[reaction.emoji] = [];
      }
      reactionsByEmoji[reaction.emoji].push({
        user_id: reaction.user_id,
        username: reaction.username,
        display_name: reaction.display_name,
        profile_image_url: reaction.profile_image_url,
        created_at: reaction.created_at
      });
    });
    
    res.json({
      success: true,
      reactions: reactions,
      reactions_by_emoji: reactionsByEmoji
    });
    
  } catch (error) {
    console.error('Error getting reactions:', error);
    res.status(500).json({ error: 'Failed to get reactions' });
  } finally {
    connection.release();
  }
});

module.exports = router;
