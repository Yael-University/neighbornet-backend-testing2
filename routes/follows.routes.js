const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/error.middleware');
const { createNotification } = require('../utils/notifications');

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

    // Check if this creates a mutual follow (followed user is also following back)
    const mutualFollow = await query(
        'SELECT follow_id FROM Follows WHERE follower_id = ? AND followed_id = ?',
        [followedId, followerId]
    );

    let isMutual = false;
    
    // If mutual follow exists, automatically create trusted contacts
    if (mutualFollow.length > 0) {
        isMutual = true;
        
        // Check if trusted contact relationships already exist
        const existingContact1 = await query(
            'SELECT contact_id FROM TrustedContacts WHERE user_id = ? AND trusted_user_id = ?',
            [followerId, followedId]
        );
        
        const existingContact2 = await query(
            'SELECT contact_id FROM TrustedContacts WHERE user_id = ? AND trusted_user_id = ?',
            [followedId, followerId]
        );
        
        // Create bidirectional trusted contacts if they don't exist
        if (existingContact1.length === 0) {
            await query(
                'INSERT INTO TrustedContacts (user_id, trusted_user_id, status) VALUES (?, ?, ?)',
                [followerId, followedId, 'accepted']
            );
        } else if (existingContact1[0].status !== 'accepted') {
            // Update status to accepted if it exists but is not accepted
            await query(
                'UPDATE TrustedContacts SET status = ? WHERE user_id = ? AND trusted_user_id = ?',
                ['accepted', followerId, followedId]
            );
        }
        
        if (existingContact2.length === 0) {
            await query(
                'INSERT INTO TrustedContacts (user_id, trusted_user_id, status) VALUES (?, ?, ?)',
                [followedId, followerId, 'accepted']
            );
        } else if (existingContact2[0].status !== 'accepted') {
            // Update status to accepted if it exists but is not accepted
            await query(
                'UPDATE TrustedContacts SET status = ? WHERE user_id = ? AND trusted_user_id = ?',
                ['accepted', followedId, followerId]
            );
        }
        
        // Send notification about becoming trusted contacts
        const followerInfo = await query(
            'SELECT display_name FROM Users WHERE user_id = ?',
            [followerId]
        );
        
        if (followerInfo && followerInfo.length > 0) {
            await createNotification({
                user_id: followedId,
                type: 'alert',
                title: 'New Trusted Contact',
                content: `You and ${followerInfo[0].display_name} are now trusted contacts! You can now message each other.`,
                related_id: followerId,
                related_type: 'user',
                priority: 'normal'
            });
        }
    } else {
        // Just send regular follow notification
        const followerInfo = await query(
            'SELECT display_name FROM Users WHERE user_id = ?',
            [followerId]
        );

        if (followerInfo && followerInfo.length > 0) {
            await createNotification({
                user_id: followedId,
                type: 'alert',
                title: 'New Follower',
                content: `${followerInfo[0].display_name} started following you`,
                related_id: followerId,
                related_type: 'user',
                priority: 'normal'
            });
        }
    }

    res.json({ 
        success: true, 
        message: isMutual ? 'Successfully followed user and became trusted contacts!' : 'Successfully followed user',
        is_mutual: isMutual
    });
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

    // Check if the other user is still following back
    const stillMutual = await query(
        'SELECT follow_id FROM Follows WHERE follower_id = ? AND followed_id = ?',
        [followedId, followerId]
    );

    // If no longer mutual, remove trusted contact relationships
    if (stillMutual.length === 0) {
        await query(
            'DELETE FROM TrustedContacts WHERE (user_id = ? AND trusted_user_id = ?) OR (user_id = ? AND trusted_user_id = ?)',
            [followerId, followedId, followedId, followerId]
        );
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
    const limit = Math.min(parseInt(req.query.limit) || 20, 200); // Cap at 200
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
        LIMIT ${limit}
        OFFSET ${offset}
    `, [userId]);

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
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const requestedLimit = parseInt(req.query.limit);
    const limit = isNaN(requestedLimit) ? 20 : Math.min(requestedLimit, 200);
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
        LIMIT ${limit}
        OFFSET ${offset}
    `, [userId]);

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
