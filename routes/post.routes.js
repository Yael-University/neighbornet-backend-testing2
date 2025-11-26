const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { asyncHandler } = require('../middleware/error.middleware');
const { requireModerator } = require('../middleware/auth.middleware');

// Simple validation functions (inline)
const validatePostContent = (content) => {
  if (!content || content.trim().length === 0) {
    return { valid: false, message: 'Post content cannot be empty' };
  }
  if (content.length > 5000) {
    return { valid: false, message: 'Post content must not exceed 5000 characters' };
  }
  return { valid: true };
};

const validatePostType = (type) => {
  const validTypes = ['incident', 'event', 'help', 'question', 'review', 'poll', 'announcement', 'general'];
  if (!type || !validTypes.includes(type)) {
    return { valid: false, message: 'Invalid post type' };
  }
  return { valid: true };
};

const validatePriority = (priority) => {
  const validPriorities = ['normal', 'high', 'urgent'];
  if (priority && !validPriorities.includes(priority)) {
    return { valid: false, message: 'Invalid priority level' };
  }
  return { valid: true };
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim();
};

router.post('/', asyncHandler(async (req, res) => {
  const {
    content,
    post_type = 'general',
    priority = 'normal',
    media_urls,
    location_lat,
    location_lng,
    visibility_radius = 5000,
    tags = []
  } = req.body;

  // Validate content
  const contentValidation = validatePostContent(content);
  if (!contentValidation.valid) {
    return res.status(400).json({ error: contentValidation.message });
  }

  // Validate post type
  const typeValidation = validatePostType(post_type);
  if (!typeValidation.valid) {
    return res.status(400).json({ error: typeValidation.message });
  }

  // Validate priority
  const priorityValidation = validatePriority(priority);
  if (!priorityValidation.valid) {
    return res.status(400).json({ error: priorityValidation.message });
  }

  // Use transaction for post creation with tags
  const result = await transaction(async (connection) => {
    // Insert post
    const [postResult] = await connection.execute(
      `INSERT INTO Posts (
        user_id, content, post_type, priority, media_urls,
        location_lat, location_lng, visibility_radius
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.user_id,
        sanitizeInput(content),
        post_type,
        priority,
        media_urls ? JSON.stringify(media_urls) : null,
        location_lat || null,
        location_lng || null,
        visibility_radius
      ]
    );

    const postId = postResult.insertId;

    // Add tags if provided
    if (tags && tags.length > 0) {
      for (const tagId of tags) {
        await connection.execute(
          'INSERT INTO PostTags (post_id, tag_id) VALUES (?, ?)',
          [postId, tagId]
        );
      }
    }

    // If it's an incident, create incident report
    if (post_type === 'incident') {
      const { incident_type, severity = 'medium', location_description } = req.body;
      
      if (!incident_type) {
        throw new Error('Incident type is required for incident posts');
      }

      await connection.execute(
        `INSERT INTO IncidentReports (
          post_id, incident_type, severity, location_description
        ) VALUES (?, ?, ?, ?)`,
        [postId, incident_type, severity, location_description || null]
      );
    }

    // Get the created post with user info
    const [posts] = await connection.execute(
      `SELECT p.*, u.name as author_name, u.profile_image_url as author_image,
       u.verification_status as author_verification
       FROM Posts p
       JOIN Users u ON p.user_id = u.user_id
       WHERE p.post_id = ?`,
      [postId]
    );

    return posts[0];
  });

  // Award badge if applicable (first post)
  const postCount = await query(
    'SELECT COUNT(*) as count FROM Posts WHERE user_id = ?',
    [req.user.user_id]
  );

  if (postCount[0].count === 1) {
    const firstPostBadge = await query(
      "SELECT badge_id FROM Badges WHERE name = 'First Post'"
    );
    
    if (firstPostBadge.length > 0) {
      await query(
        'INSERT IGNORE INTO UserBadges (user_id, badge_id) VALUES (?, ?)',
        [req.user.user_id, firstPostBadge[0].badge_id]
      );
    }
  }

  res.status(201).json({
    success: true,
    message: 'Post created successfully',
    post: result
  });
}));

router.get('/:postId', asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const posts = await query(
    `SELECT p.*, u.name as author_name, u.profile_image_url as author_image,
     u.verification_status as author_verification, u.user_id as author_id
     FROM Posts p
     JOIN Users u ON p.user_id = u.user_id
     WHERE p.post_id = ? AND p.status = ?`,
    [postId, 'active']
  );

  if (posts.length === 0) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const post = posts[0];

  // Get tags for this post
  const tags = await query(
    `SELECT t.tag_id, t.name, t.category, t.color
     FROM PostTags pt
     JOIN Tags t ON pt.tag_id = t.tag_id
     WHERE pt.post_id = ?`,
    [postId]
  );

  post.tags = tags;

  // If it's an incident, get incident details
  if (post.post_type === 'incident') {
    const incidents = await query(
      `SELECT * FROM IncidentReports WHERE post_id = ?`,
      [postId]
    );
    
    if (incidents.length > 0) {
      post.incident_details = incidents[0];
    }
  }

  res.json({
    success: true,
    post: post
  });
}));

router.get('/tags/all', asyncHandler(async (req, res) => {
  const tags = await query(
    'SELECT * FROM Tags ORDER BY category, name'
  );

  res.json({
    success: true,
    tags: tags
  });
}));

module.exports = router;