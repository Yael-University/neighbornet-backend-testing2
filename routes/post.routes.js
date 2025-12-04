const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { asyncHandler } = require('../middleware/error.middleware');
const { requireModerator } = require('../middleware/auth.middleware');
const { uploadPostImage, compressImage } = require('../middleware/upload.middleware');

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

router.post('/', uploadPostImage, compressImage, asyncHandler(async (req, res) => {
  const {
    content,
    post_type = 'general',
    priority = 'normal',
    media_urls,
    location_lat,
    location_lng,
    visibility_radius = 5000
  } = req.body;

  // Parse tags if sent as JSON string from FormData
  let tags = [];
  if (req.body.tags) {
    try {
      tags = typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags;
    } catch (e) {
      tags = [];
    }
  }

  // Generate image URL if file was uploaded
  // Use request host to ensure mobile devices can access images
  const post_image = req.file 
    ? `${req.protocol}://${req.get('host')}/uploads/posts/${req.file.filename}`
    : null;

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
    // Insert post with image
    const [postResult] = await connection.execute(
      `INSERT INTO Posts (
        user_id, content, post_type, priority, media_urls, post_image,
        location_lat, location_lng, visibility_radius
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.user_id,
        sanitizeInput(content),
        post_type,
        priority,
        media_urls ? JSON.stringify(media_urls) : null,
        post_image,
        location_lat || null,
        location_lng || null,
        visibility_radius
      ]
    );

    const postId = postResult.insertId;

    // Add tags if provided (tags can be tag IDs or tag names)
    if (tags && tags.length > 0) {
      for (const tag of tags) {
        let tagId;
        
        // If tag is a string (tag name), find or create it
        if (typeof tag === 'string') {
          const tagName = tag.toLowerCase().trim();
          
          // Try to find existing tag
          const [existingTags] = await connection.execute(
            'SELECT tag_id FROM Tags WHERE LOWER(name) = ?',
            [tagName]
          );
          
          if (existingTags.length > 0) {
            tagId = existingTags[0].tag_id;
          } else {
            // Create new tag
            const [newTag] = await connection.execute(
              'INSERT INTO Tags (name, category) VALUES (?, ?)',
              [tagName, 'general']
            );
            tagId = newTag.insertId;
          }
        } else {
          // Tag is already an ID
          tagId = tag;
        }
        
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

    // Get the created post with user info and tags
    const [posts] = await connection.execute(
      `SELECT p.*, u.name as author_name, u.profile_image_url as author_image,
       u.verification_status as author_verification
       FROM Posts p
       JOIN Users u ON p.user_id = u.user_id
       WHERE p.post_id = ?`,
      [postId]
    );

    const post = posts[0];

    // Get tags as string array
    const [postTags] = await connection.execute(
      `SELECT t.name
       FROM PostTags pt
       JOIN Tags t ON pt.tag_id = t.tag_id
       WHERE pt.post_id = ?`,
      [postId]
    );

    post.tags = postTags.map(t => t.name);

    return post;
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
    `SELECT p.*, u.name as author_name, u.username as username, u.profile_image_url as author_image,
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

  // Get tags for this post as string array
  const tags = await query(
    `SELECT t.name
     FROM PostTags pt
     JOIN Tags t ON pt.tag_id = t.tag_id
     WHERE pt.post_id = ?`,
    [postId]
  );

  post.tags = tags.map(t => t.name);

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

// Add comment to a post
router.post("/:post_id/comments", asyncHandler(async (req, res) => {
  const { post_id } = req.params;
  const { content } = req.body;

  if (!req.user?.user_id) return res.status(401).json({ error: "Unauthorized" });
  if (!content || content.trim().length === 0) return res.status(400).json({ error: "Content cannot be empty" });

  const userId = req.user.user_id;

  const result = await query("INSERT INTO Comments (post_id, user_id, content) VALUES (?, ?, ?)", [post_id, userId, content.trim()]);

  await query("UPDATE Posts SET comments_count = comments_count + 1 WHERE post_id = ?", [post_id]);

  res.json({ success: true, message: "Comment added", comment_id: result.insertId });
}));

// Get all comments for a post
router.get("/:post_id/comments", asyncHandler(async (req, res) => {
  const { post_id } = req.params;

  // Optional: check if post exists first
  const post = await query("SELECT post_id FROM Posts WHERE post_id = ?", [post_id]);
  if (post.length === 0) return res.status(404).json({ success: false, error: "Post not found" });

  // Fetch comments with user info
  const comments = await query(
      `SELECT c.comment_id, c.content, c.created_at, u.user_id, u.name as author_name, u.profile_image_url as author_image
         FROM Comments c
         JOIN Users u ON c.user_id = u.user_id
         WHERE c.post_id = ?
         ORDER BY c.created_at ASC`,
      [post_id]
  );

  res.json({ success: true, post_id, comments });
}));


// Like a post
router.post("/:post_id/like", asyncHandler(async (req, res) => {
  const { post_id } = req.params;

  if (!req.user?.user_id) return res.status(401).json({ error: "Unauthorized" });

  const userId = req.user.user_id;

  try {
    await query("INSERT INTO Likes (user_id, post_id) VALUES (?, ?)", [userId, post_id]);
    await query("UPDATE Posts SET likes_count = likes_count + 1 WHERE post_id = ?", [post_id]);
    res.json({ success: true, message: "Post liked!" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "User already liked this post" });
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}));

// Unlike a post
router.delete("/:post_id/like", asyncHandler(async (req, res) => {
  const { post_id } = req.params;

  if (!req.user?.user_id) return res.status(401).json({ error: "Unauthorized" });

  const userId = req.user.user_id;

  const result = await query("DELETE FROM Likes WHERE user_id = ? AND post_id = ?", [userId, post_id]);

  if (result.affectedRows > 0) await query("UPDATE Posts SET likes_count = likes_count - 1 WHERE post_id = ?", [post_id]);

  res.json({ success: true, message: "Unliked post" });
}));

// Check if user has liked a post
router.get("/:post_id/like/status", asyncHandler(async (req, res) => {
  const { post_id } = req.params;

  if (!req.user?.user_id) return res.status(401).json({ error: "Unauthorized" });

  const userId = req.user.user_id;

  const likes = await query("SELECT * FROM Likes WHERE user_id = ? AND post_id = ?", [userId, post_id]);

  res.json({ 
    success: true, 
    liked: likes.length > 0 
  });
}));

// Update a post (owner only)
router.put("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, post_type, priority, media_urls, tags } = req.body;

  if (!req.user?.user_id) return res.status(401).json({ error: "Unauthorized" });

  // Check if post exists and user is the owner
  const posts = await query("SELECT user_id FROM Posts WHERE post_id = ?", [id]);
  if (posts.length === 0) return res.status(404).json({ error: "Post not found" });
  
  if (posts[0].user_id !== req.user.user_id) {
    return res.status(403).json({ error: "You can only edit your own posts" });
  }

  // Validate content if provided
  if (content !== undefined) {
    const contentValidation = validatePostContent(content);
    if (!contentValidation.valid) {
      return res.status(400).json({ error: contentValidation.message });
    }
  }

  // Validate post type if provided
  if (post_type !== undefined) {
    const typeValidation = validatePostType(post_type);
    if (!typeValidation.valid) {
      return res.status(400).json({ error: typeValidation.message });
    }
  }

  // Validate priority if provided
  if (priority !== undefined) {
    const priorityValidation = validatePriority(priority);
    if (!priorityValidation.valid) {
      return res.status(400).json({ error: priorityValidation.message });
    }
  }

  // Build update query dynamically
  const updates = [];
  const values = [];

  if (content !== undefined) {
    updates.push("content = ?");
    values.push(sanitizeInput(content));
  }
  if (post_type !== undefined) {
    updates.push("post_type = ?");
    values.push(post_type);
  }
  if (priority !== undefined) {
    updates.push("priority = ?");
    values.push(priority);
  }
  if (media_urls !== undefined) {
    updates.push("media_urls = ?");
    values.push(media_urls ? JSON.stringify(media_urls) : null);
  }

  if (updates.length > 0) {
    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);
    await query(`UPDATE Posts SET ${updates.join(", ")} WHERE post_id = ?`, values);
  }

  // Update tags if provided
  if (tags !== undefined && Array.isArray(tags)) {
    await query("DELETE FROM PostTags WHERE post_id = ?", [id]);
    for (const tagId of tags) {
      await query("INSERT INTO PostTags (post_id, tag_id) VALUES (?, ?)", [id, tagId]);
    }
  }

  // Get updated post
  const updatedPosts = await query(
    `SELECT p.*, u.name as author_name, u.profile_image_url as author_image,
     u.verification_status as author_verification
     FROM Posts p
     JOIN Users u ON p.user_id = u.user_id
     WHERE p.post_id = ?`,
    [id]
  );

  res.json({ success: true, message: "Post updated successfully", post: updatedPosts[0] });
}));

// Delete a post (owner only)
router.delete("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!req.user?.user_id) return res.status(401).json({ error: "Unauthorized" });

  // Check if post exists and user is the owner
  const posts = await query("SELECT user_id FROM Posts WHERE post_id = ?", [id]);
  if (posts.length === 0) return res.status(404).json({ error: "Post not found" });
  
  if (posts[0].user_id !== req.user.user_id) {
    return res.status(403).json({ error: "You can only delete your own posts" });
  }

  // Soft delete: update status to 'removed' (valid enum value)
  await query("UPDATE Posts SET status = 'removed', updated_at = CURRENT_TIMESTAMP WHERE post_id = ?", [id]);

  res.json({ success: true, message: "Post deleted successfully" });
}));

// Update a comment (owner only)
router.put("/:postId/comments/:commentId", asyncHandler(async (req, res) => {
  const { postId, commentId } = req.params;
  const { content } = req.body;

  if (!req.user?.user_id) return res.status(401).json({ error: "Unauthorized" });
  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: "Content cannot be empty" });
  }

  // Check if comment exists and user is the owner
  const comments = await query(
    "SELECT user_id, post_id FROM Comments WHERE comment_id = ?",
    [commentId]
  );
  
  if (comments.length === 0) return res.status(404).json({ error: "Comment not found" });
  
  if (comments[0].user_id !== req.user.user_id) {
    return res.status(403).json({ error: "You can only edit your own comments" });
  }

  if (comments[0].post_id !== parseInt(postId)) {
    return res.status(400).json({ error: "Comment does not belong to this post" });
  }

  // Update comment (Comments table doesn't have updated_at column)
  await query(
    "UPDATE Comments SET content = ? WHERE comment_id = ?",
    [content.trim(), commentId]
  );

  // Get updated comment
  const updatedComments = await query(
    `SELECT c.comment_id, c.content, c.created_at, 
     u.user_id, u.name as author_name, u.profile_image_url as author_image
     FROM Comments c
     JOIN Users u ON c.user_id = u.user_id
     WHERE c.comment_id = ?`,
    [commentId]
  );

  res.json({ 
    success: true, 
    message: "Comment updated successfully", 
    comment: updatedComments[0] 
  });
}));

// Delete a comment (owner only)
router.delete("/:postId/comments/:commentId", asyncHandler(async (req, res) => {
  const { postId, commentId } = req.params;

  if (!req.user?.user_id) return res.status(401).json({ error: "Unauthorized" });

  // Check if comment exists and user is the owner
  const comments = await query(
    "SELECT user_id, post_id FROM Comments WHERE comment_id = ?",
    [commentId]
  );
  
  if (comments.length === 0) return res.status(404).json({ error: "Comment not found" });
  
  if (comments[0].user_id !== req.user.user_id) {
    return res.status(403).json({ error: "You can only delete your own comments" });
  }

  if (comments[0].post_id !== parseInt(postId)) {
    return res.status(400).json({ error: "Comment does not belong to this post" });
  }

  // Delete comment
  await query("DELETE FROM Comments WHERE comment_id = ?", [commentId]);

  // Decrement comments count
  await query("UPDATE Posts SET comments_count = comments_count - 1 WHERE post_id = ?", [postId]);

  res.json({ success: true, message: "Comment deleted successfully" });
}));

module.exports = router;
