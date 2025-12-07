const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/error.middleware');

// Create a new notification
router.post('/', asyncHandler(async (req, res) => {
  const { user_id, type, title, content, related_id, related_type, priority } = req.body;

  // Validate required fields
  if (!user_id || !type) {
    return res.status(400).json({ error: 'user_id and type are required' });
  }

  // Validate type enum
  const validTypes = ['alert', 'message', 'event', 'badge', 'verification', 'system'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid notification type' });
  }

  // Create notification
  const result = await query(
    `INSERT INTO Notifications (user_id, type, title, content, related_id, related_type, priority)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      user_id,
      type,
      title || 'New Notification',
      content || null,
      related_id || null,
      related_type || null,
      priority || 'normal'
    ]
  );

  res.status(201).json({
    success: true,
    message: 'Notification created',
    notification_id: result.insertId
  });
}));

// Get all notifications for the authenticated user
router.get('/', asyncHandler(async (req, res) => {
  const { limit = 50, unread_only = false } = req.query;
  
  if (!req.user?.user_id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let queryStr = `
    SELECT n.notification_id,
           n.user_id,
           n.type,
           n.title,
           n.content as message,
           n.related_id,
           n.is_read,
           n.created_at
    FROM Notifications n
    WHERE n.user_id = ?
  `;

  const params = [req.user.user_id];

  if (unread_only === 'true') {
    queryStr += ' AND n.is_read = FALSE';
  }

  const limitValue = parseInt(limit);
  queryStr += ` ORDER BY n.created_at DESC LIMIT ${limitValue}`;

  const notificationsData = await query(queryStr, params);

  // Map database types to frontend types
  const typeMapping = {
    'alert': 'post_like',
    'message': 'post_comment', 
    'event': 'event_rsvp',
    'badge': 'badge_earned',
    'system': 'event_reminder'
  };

  const notifications = notificationsData.map(n => ({
    notification_id: n.notification_id,
    user_id: n.user_id,
    type: typeMapping[n.type] || n.type,
    title: n.title,
    message: n.message,
    related_id: n.related_id,
    is_read: n.is_read ? true : false,
    created_at: n.created_at
  }));

  res.json({ notifications });
}));

// Get unread notification count
router.get('/unread/count', asyncHandler(async (req, res) => {
  if (!req.user?.user_id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const result = await query(
    'SELECT COUNT(*) as count FROM Notifications WHERE user_id = ? AND is_read = FALSE',
    [req.user.user_id]
  );

  res.json({
    success: true,
    unread_count: result[0].count
  });
}));

// Mark notification as read
router.patch('/:notificationId/read', asyncHandler(async (req, res) => {
  const { notificationId } = req.params;

  if (!req.user?.user_id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify the notification belongs to the user
  const notifications = await query(
    'SELECT user_id FROM Notifications WHERE notification_id = ?',
    [notificationId]
  );

  if (notifications.length === 0) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  if (notifications[0].user_id !== req.user.user_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await query(
    'UPDATE Notifications SET is_read = TRUE WHERE notification_id = ?',
    [notificationId]
  );

  res.json({
    success: true,
    message: 'Notification marked as read'
  });
}));

// Mark all notifications as read
router.patch('/read-all', asyncHandler(async (req, res) => {
  if (!req.user?.user_id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  await query(
    'UPDATE Notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
    [req.user.user_id]
  );

  res.json({
    success: true,
    message: 'All notifications marked as read'
  });
}));

// Delete a notification
router.delete('/:notificationId', asyncHandler(async (req, res) => {
  const { notificationId } = req.params;

  if (!req.user?.user_id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify the notification belongs to the user
  const notifications = await query(
    'SELECT user_id FROM Notifications WHERE notification_id = ?',
    [notificationId]
  );

  if (notifications.length === 0) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  if (notifications[0].user_id !== req.user.user_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await query('DELETE FROM Notifications WHERE notification_id = ?', [notificationId]);

  res.json({
    success: true,
    message: 'Notification deleted'
  });
}));

// Clear all read notifications
router.delete('/clear-read', asyncHandler(async (req, res) => {
  if (!req.user?.user_id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  await query(
    'DELETE FROM Notifications WHERE user_id = ? AND is_read = TRUE',
    [req.user.user_id]
  );

  res.json({
    success: true,
    message: 'Read notifications cleared'
  });
}));

// Register notification token
router.post('/register-token', async (req, res) => {
  try {
    const { token, platform, device_id } = req.body;
    const userId = req.user.user_id;
    
    if (!token || !platform) {
      return res.status(400).json({ error: 'Token and platform are required' });
    }
    
    // Validate platform
    const validPlatforms = ['ios', 'android', 'web'];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform. Must be ios, android, or web' });
    }
    
    // Insert or update token
    await query(
      `INSERT INTO NotificationTokens (user_id, token, platform, device_id, is_active, last_used_at)
       VALUES (?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE 
         user_id = VALUES(user_id),
         platform = VALUES(platform),
         device_id = VALUES(device_id),
         is_active = TRUE,
         last_used_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, token, platform, device_id || null]
    );
    
    res.json({
      success: true,
      message: 'Notification token registered successfully'
    });
  } catch (error) {
    console.error('Register token error:', error);
    res.status(500).json({ error: 'Failed to register token' });
  }
});

// Unregister notification token
router.delete('/token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user.user_id;
    
    // Verify token belongs to user before deleting
    const result = await query(
      'DELETE FROM NotificationTokens WHERE token = ? AND user_id = ?',
      [token, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Token not found or does not belong to user' });
    }
    
    res.json({
      success: true,
      message: 'Notification token unregistered successfully'
    });
  } catch (error) {
    console.error('Unregister token error:', error);
    res.status(500).json({ error: 'Failed to unregister token' });
  }
});

// Get all registered tokens for current user
router.get('/tokens', async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    const tokens = await query(
      `SELECT token_id, token, platform, device_id, is_active, created_at, last_used_at
       FROM NotificationTokens
       WHERE user_id = ? AND is_active = TRUE
       ORDER BY last_used_at DESC`,
      [userId]
    );
    
    res.json({
      success: true,
      tokens: tokens
    });
  } catch (error) {
    console.error('Get tokens error:', error);
    res.status(500).json({ error: 'Failed to get tokens' });
  }
});

// Deactivate a token (soft delete)
router.patch('/token/:token/deactivate', async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user.user_id;
    
    const result = await query(
      'UPDATE NotificationTokens SET is_active = FALSE WHERE token = ? AND user_id = ?',
      [token, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Token not found or does not belong to user' });
    }
    
    res.json({
      success: true,
      message: 'Notification token deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate token error:', error);
    res.status(500).json({ error: 'Failed to deactivate token' });
  }
});

module.exports = router;
