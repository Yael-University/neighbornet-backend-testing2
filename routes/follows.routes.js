const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/error.middleware');

// POST /api/follows/follow/:user_id - Follow a user
router.post('/follow/:user_id', asyncHandler(async (req, res) => {
    if (!req.user?.user_id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const followerId = req.user.user_id;
    const followedId = parseInt(req.params.user_id);

    // Prevent self-follow
    if (followerId === followedId) {
        return res.status(400).json({ success: false, message: 'Cannot follow yourself' });
    }

    // Check if followed user exists
    const userExists = await query('SELECT user_id FROM Users WHERE user_id = ?', [followedId]);
    if (userExists.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if already following
    const existingFollow = await query(
        'SELECT follow_id FROM Follows WHERE follower_id = ? AND followed_id = ?',
        [followerId, followedId]
    );

    if (existingFollow.length > 0) {
        return res.status(409).json({ success: false, message: 'Already following this user' });
    }

    // Create follow relationship
    await query(
        'INSERT INTO Follows (follower_id, followed_id) VALUES (?, ?)',
        [followerId, followedId]
    );

    res.json({ success: true, message: 'Successfully followed user' });
}));

// POST /api/follows/unfollow/:user_id - Unfollow a user
router.post('/unfollow/:user_id', asyncHandler(async (req, res) => {
    if (!req.user?.user_id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const followerId = req.user.user_id;
    const followedId = parseInt(req.params.user_id);

    // Delete follow relationship
    const result = await query(
        'DELETE FROM Follows WHERE follower_id = ? AND followed_id = ?',
        [followerId, followedId]
    );

    if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Not following this user' });
    }

    res.json({ success: true, message: 'Successfully unfollowed user' });
}));

// GET /api/follows/is-following/:user_id - Check if following a user
router.get('/is-following/:user_id', asyncHandler(async (req, res) => {
    if (!req.user?.user_id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const followerId = req.user.user_id;
    const followedId = parseInt(req.params.user_id);

    const follows = await query(
        'SELECT follow_id FROM Follows WHERE follower_id = ? AND followed_id = ?',
        [followerId, followedId]
    );

    res.json({ 
        success: true, 
        isFollowing: follows.length > 0 
    });
}));

// GET /api/follows/counts/:user_id - Get follower and following counts
router.get('/counts/:user_id', asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.user_id);

    // Get follower count (people following this user)
    const followerResult = await query(
        'SELECT COUNT(*) as count FROM Follows WHERE followed_id = ?',
        [userId]
    );

    // Get following count (people this user is following)
    const followingResult = await query(
        'SELECT COUNT(*) as count FROM Follows WHERE follower_id = ?',
        [userId]
    );

    res.json({
        success: true,
        followers: followerResult[0].count,
        following: followingResult[0].count
    });
}));

// GET /api/follows/followers/:user_id - Get list of followers
router.get('/followers/:user_id', asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.user_id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Get followers with user details
    const followers = await query(`
        SELECT 
            u.user_id,
            u.name,
            u.username,
            u.display_name,
            u.profile_image_url,
            u.bio,
            u.verification_status,
            f.created_at as followed_at
        FROM Follows f
        JOIN Users u ON f.follower_id = u.user_id
        WHERE f.followed_id = ?
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
    `, [userId, limit, offset]);

    // Get total count
    const countResult = await query(
        'SELECT COUNT(*) as total FROM Follows WHERE followed_id = ?',
        [userId]
    );

    res.json({
        success: true,
        followers: followers,
        pagination: {
            page,
            limit,
            total: countResult[0].total,
            pages: Math.ceil(countResult[0].total / limit)
        }
    });
}));

// GET /api/follows/following/:user_id - Get list of users being followed
router.get('/following/:user_id', asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.user_id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Get following with user details
    const following = await query(`
        SELECT 
            u.user_id,
            u.name,
            u.username,
            u.display_name,
            u.profile_image_url,
            u.bio,
            u.verification_status,
            f.created_at as followed_at
        FROM Follows f
        JOIN Users u ON f.followed_id = u.user_id
        WHERE f.follower_id = ?
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
    `, [userId, limit, offset]);

    // Get total count
    const countResult = await query(
        'SELECT COUNT(*) as total FROM Follows WHERE follower_id = ?',
        [userId]
    );

    res.json({
        success: true,
        following: following,
        pagination: {
            page,
            limit,
            total: countResult[0].total,
            pages: Math.ceil(countResult[0].total / limit)
        }
    });
}));

module.exports = router;
