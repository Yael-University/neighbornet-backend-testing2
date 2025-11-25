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
  const user_id = req.user?.user_id;  // From JWT middleware
  if (!user_id) return res.status(401).json({ error: "Unauthorized" });

  const { title, description, event_date, location, location_lat, location_lng, max_attendees } = req.body;

  if (!title || !event_date)
    return res.status(400).json({ error: "Missing required fields" });

  // 1. Create the post
  const [newPost] = await query(
      `INSERT INTO Posts (title, content, author_id)
         VALUES (?, ?, ?)`,
      [`Event: ${title}`, description ?? '', user_id]
  );

  // 2. Get the inserted post_id
  const post_id = newPost.insertId;

  // 3. Create the event using the new post_id
  await query(
      `INSERT INTO Events 
         (post_id, title, description, event_date, location, location_lat, location_lng, max_attendees, organizer_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        post_id,
        title,
        description ?? null,
        event_date,
        location ?? null,
        location_lat ?? null,
        location_lng ?? null,
        max_attendees ?? null,
        user_id
      ]
  );

  const [newEvent] = await query(
      `SELECT * FROM Events WHERE post_id = ?`,
      [post_id]
  );

  res.json({ success: true, event: newEvent });
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