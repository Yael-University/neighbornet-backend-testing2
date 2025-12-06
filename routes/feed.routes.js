const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/error.middleware');

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
};

router.get('/', asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); // Disable caching, fix for comment num not updating on feed

    // Get all active posts first
    if (!req.user || !req.user.user_id) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get user location
    const users = await query(
        'SELECT latitude, longitude, street FROM Users WHERE user_id = ?',
        [req.user.user_id]
    );

    if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    const userLocation = users[0];

    // Simple query - just get all active posts
    const posts = await query(
        `SELECT
             p.post_id,
             p.user_id,
             p.content,
             p.post_type,
             p.priority,
             p.is_verified,
             p.media_urls,
             p.post_image,
             p.location_lat,
             p.location_lng,
             p.visibility_radius,
             p.likes_count,
             COUNT(c.comment_id) AS comments_count,   -- ✅ Fixed
             p.is_pinned,
             p.status,
             p.created_at,
             p.updated_at,
             u.user_id as author_id,
             u.username as username,
             u.display_name as display_name,
             u.name as author_name,
             u.profile_image_url as author_image,
             u.verification_status as author_verification,
             u.street as author_street,
             u.latitude as author_latitude,
             u.longitude as author_longitude
         FROM Posts p
                  JOIN Users u ON p.user_id = u.user_id
                  LEFT JOIN Comments c ON c.post_id = p.post_id  -- ✅ Added join
         WHERE p.status = ?
         GROUP BY p.post_id                            -- ✅ Required for COUNT
         ORDER BY p.is_pinned DESC, p.created_at DESC`,
        ['active']
    );



    // Process posts
    const processedPosts = [];

    for (const post of posts) {
        // Calculate distance
        let distance = null;
        if (userLocation.latitude && userLocation.longitude &&
            post.location_lat && post.location_lng) {
            distance = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                post.location_lat,
                post.location_lng
            );
        } else if (userLocation.latitude && userLocation.longitude &&
            post.author_latitude && post.author_longitude) {
            distance = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                post.author_latitude,
                post.author_longitude
            );
        }

        // Get tags as string array
        const tagResults = await query(
            `SELECT t.name
       FROM PostTags pt
       JOIN Tags t ON pt.tag_id = t.tag_id
       WHERE pt.post_id = ?`,
            [post.post_id]
        );
        
        const tags = tagResults.map(t => t.name);

        // Get incident details if needed
        let incident_details = null;
        if (post.post_type === 'incident') {
            const incidents = await query(
                'SELECT * FROM IncidentReports WHERE post_id = ?',
                [post.post_id]
            );
            if (incidents.length > 0) {
                incident_details = incidents[0];
            }
        }

        // Parse media URLs
        let media_urls = null;
        if (post.media_urls) {
            try {
                media_urls = JSON.parse(post.media_urls);
            } catch (e) {
                media_urls = post.media_urls;
            }
        }

        processedPosts.push({
            post_id: post.post_id,
            user_id: post.user_id,
            content: post.content,
            post_type: post.post_type,
            priority: post.priority,
            is_verified: post.is_verified,
            media_urls,
            post_image: post.post_image,
            image: post.post_image, // Alias for compatibility
            location_lat: post.location_lat,
            location_lng: post.location_lng,
            visibility_radius: post.visibility_radius,
            likes_count: post.likes_count,
            comments_count: post.comments_count,
            is_pinned: post.is_pinned,
            status: post.status,
            created_at: post.created_at,
            updated_at: post.updated_at,
            author_id: post.author_id,
            author_name: post.author_name,
            name: post.author_name, // Alias for compatibility
            username: post.username,
            display_name: post.display_name,
            author_image: post.author_image,
            profile_image: post.author_image, // Alias for frontend compatibility
            author_verification: post.author_verification,
            author_street: post.author_street,
            tags,
            incident_details,
            distance: distance ? Math.round(distance) : null,
            distance_text: distance ? `${(distance / 1000).toFixed(1)} km away` : null
        });
    }

    res.json({
        success: true,
        posts: processedPosts,
        pagination: {
            page: 1,
            limit: processedPosts.length,
            total: processedPosts.length,
            pages: 1
        }
    });
}));

router.get('/priority', asyncHandler(async (req, res) => {
    if (!req.user || !req.user.user_id) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    const users = await query(
        'SELECT latitude, longitude FROM Users WHERE user_id = ?',
        [req.user.user_id]
    );

    if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    const userLocation = users[0];
    const limitValue = 10;

    const posts = await query(
        `SELECT 
      p.*,
      u.user_id as author_id,
      u.name as author_name,
      u.display_name as display_name,
      u.username as username,
      u.profile_image_url as author_image,
      u.verification_status as author_verification,
      u.latitude as author_latitude,
      u.longitude as author_longitude
    FROM Posts p
    JOIN Users u ON p.user_id = u.user_id
    WHERE p.status = ? 
      AND (p.priority = ? OR p.priority = ?)
      AND p.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    ORDER BY FIELD(p.priority, 'urgent', 'high'), p.created_at DESC
    LIMIT ?`,
        ['active', 'high', 'urgent', limitValue]
    );

    const processedPosts = [];

    for (const post of posts) {
        let distance = null;
        if (userLocation.latitude && userLocation.longitude &&
            post.author_latitude && post.author_longitude) {
            distance = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                post.author_latitude,
                post.author_longitude
            );
        }

        const tagResults = await query(
            `SELECT t.name
       FROM PostTags pt
       JOIN Tags t ON pt.tag_id = t.tag_id
       WHERE pt.post_id = ?`,
            [post.post_id]
        );
        
        const tags = tagResults.map(t => t.name);

        let incident_details = null;
        if (post.post_type === 'incident') {
            const incidents = await query(
                'SELECT * FROM IncidentReports WHERE post_id = ?',
                [post.post_id]
            );
            if (incidents.length > 0) {
                incident_details = incidents[0];
            }
        }

        processedPosts.push({
            ...post,
            tags,
            incident_details,
            distance: distance ? Math.round(distance) : null
        });
    }

    res.json({
        success: true,
        alerts: processedPosts
    });
}));

router.get('/search', asyncHandler(async (req, res) => {
    const searchQuery = req.query.query;
    const tag = req.query.tag;

    if (!searchQuery && !tag) {
        return res.status(400).json({
            error: 'Search query or tag is required'
        });
    }

    let posts;

    if (searchQuery && !tag) {
        posts = await query(
            `SELECT 
        p.*,
        u.user_id as author_id,
        u.name as author_name,
        u.username as username,
        u.display_name as display_name,
        u.profile_image_url as author_image,
        u.verification_status as author_verification
      FROM Posts p
      JOIN Users u ON p.user_id = u.user_id
      WHERE p.status = ? AND p.content LIKE ?
      ORDER BY p.created_at DESC`,
            ['active', `%${searchQuery}%`]
        );
    } else if (tag && !searchQuery) {
        posts = await query(
            `SELECT 
        p.*,
        u.user_id as author_id,
        u.name as author_name,
        u.username as username,
        u.display_name as display_name,
        u.profile_image_url as author_image,
        u.verification_status as author_verification
      FROM Posts p
      JOIN Users u ON p.user_id = u.user_id
      WHERE p.status = ? 
        AND EXISTS (
          SELECT 1 FROM PostTags pt 
          JOIN Tags t ON pt.tag_id = t.tag_id 
          WHERE pt.post_id = p.post_id AND t.name = ?
        )
      ORDER BY p.created_at DESC`,
            ['active', tag]
        );
    } else {
        posts = await query(
            `SELECT 
        p.*,
        u.user_id as author_id,
        u.name as author_name,
        u.username as username,
        u.display_name as display_name,
        u.profile_image_url as author_image,
        u.verification_status as author_verification
      FROM Posts p
      JOIN Users u ON p.user_id = u.user_id
      WHERE p.status = ? 
        AND p.content LIKE ?
        AND EXISTS (
          SELECT 1 FROM PostTags pt 
          JOIN Tags t ON pt.tag_id = t.tag_id 
          WHERE pt.post_id = p.post_id AND t.name = ?
        )
      ORDER BY p.created_at DESC`,
            ['active', `%${searchQuery}%`, tag]
        );
    }

    const processedPosts = [];

    for (const post of posts) {
        const tagResults = await query(
            `SELECT t.name
       FROM PostTags pt
       JOIN Tags t ON pt.tag_id = t.tag_id
       WHERE pt.post_id = ?`,
            [post.post_id]
        );
        
        const tags = tagResults.map(t => t.name);

        processedPosts.push({ ...post, tags });
    }

    res.json({
        success: true,
        query: searchQuery,
        posts: processedPosts
    });
}));

module.exports = router;
