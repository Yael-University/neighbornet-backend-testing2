const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/error.middleware');
const { calculateDistance, validateCoordinates } = require('../utils/location');

// ------------------------------
// GET events within radius (for maps)
// ------------------------------
router.get('/nearby', asyncHandler(async (req, res) => {
    const { latitude, longitude, radius = 10, limit = 100, status = 'upcoming' } = req.query;

    // Validate coordinates
    if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const validation = validateCoordinates(parseFloat(latitude), parseFloat(longitude));
    if (!validation.isValid) {
        return res.status(400).json({ error: validation.error });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radiusKm = parseFloat(radius);
    const maxResults = parseInt(limit);

    // Get all events with location data
    let queryStr = `
        SELECT 
            e.*,
            u.name AS organizer_name,
            u.profile_image_url AS organizer_image,
            (6371 * acos(
                cos(radians(?)) * cos(radians(e.location_lat)) * 
                cos(radians(e.location_lng) - radians(?)) + 
                sin(radians(?)) * sin(radians(e.location_lat))
            )) AS distance
        FROM Events e
        JOIN Users u ON e.organizer_id = u.user_id
        WHERE e.location_lat IS NOT NULL 
        AND e.location_lng IS NOT NULL
    `;

    const params = [lat, lng, lat];

    if (status && status !== 'all') {
        queryStr += ` AND e.status = ?`;
        params.push(status);
    }

    queryStr += `
        HAVING distance <= ?
        ORDER BY distance ASC, e.event_date ASC
        LIMIT ?
    `;
    params.push(radiusKm, maxResults);

    const events = await query(queryStr, params);

    // Add attendee counts
    for (let event of events) {
        const [rsvpData] = await query(
            `SELECT 
                COUNT(CASE WHEN status = 'going' THEN 1 END) as going_count,
                COUNT(CASE WHEN status = 'interested' THEN 1 END) as interested_count
             FROM RSVPs 
             WHERE event_id = ?`,
            [event.event_id]
        );
        event.going_count = rsvpData?.going_count || 0;
        event.interested_count = rsvpData?.interested_count || 0;
    }

    res.json({ 
        success: true, 
        events,
        center: { latitude: lat, longitude: lng },
        radius: radiusKm,
        count: events.length
    });
}));

// ------------------------------
// GET events within map bounds (viewport)
// ------------------------------
router.get('/map-bounds', asyncHandler(async (req, res) => {
    const { north, south, east, west, status = 'upcoming', limit = 200 } = req.query;

    // Validate bounds
    if (!north || !south || !east || !west) {
        return res.status(400).json({ 
            error: 'All bounds required: north, south, east, west' 
        });
    }

    const bounds = {
        north: parseFloat(north),
        south: parseFloat(south),
        east: parseFloat(east),
        west: parseFloat(west)
    };

    // Validate each coordinate
    if (bounds.north < -90 || bounds.north > 90 || 
        bounds.south < -90 || bounds.south > 90 ||
        bounds.east < -180 || bounds.east > 180 || 
        bounds.west < -180 || bounds.west > 180) {
        return res.status(400).json({ error: 'Invalid coordinate bounds' });
    }

    let queryStr = `
        SELECT 
            e.*,
            u.name AS organizer_name,
            u.profile_image_url AS organizer_image
        FROM Events e
        JOIN Users u ON e.organizer_id = u.user_id
        WHERE e.location_lat IS NOT NULL 
        AND e.location_lng IS NOT NULL
        AND e.location_lat BETWEEN ? AND ?
        AND e.location_lng BETWEEN ? AND ?
    `;

    const params = [bounds.south, bounds.north, bounds.west, bounds.east];

    if (status && status !== 'all') {
        queryStr += ` AND e.status = ?`;
        params.push(status);
    }

    queryStr += ` ORDER BY e.event_date ASC LIMIT ?`;
    params.push(parseInt(limit));

    const events = await query(queryStr, params);

    // Add attendee counts
    for (let event of events) {
        const [rsvpData] = await query(
            `SELECT 
                COUNT(CASE WHEN status = 'going' THEN 1 END) as going_count,
                COUNT(CASE WHEN status = 'interested' THEN 1 END) as interested_count
             FROM RSVPs 
             WHERE event_id = ?`,
            [event.event_id]
        );
        event.going_count = rsvpData?.going_count || 0;
        event.interested_count = rsvpData?.interested_count || 0;
    }

    res.json({ 
        success: true, 
        events,
        bounds,
        count: events.length
    });
}));

// ------------------------------
// GET all events (with optional filters)
// ------------------------------
router.get('/', asyncHandler(async (req, res) => {
    const { status, from_date, to_date, limit = 100 } = req.query;

    let queryStr = `
        SELECT 
            e.*, 
            u.name AS organizer_name,
            u.profile_image_url AS organizer_image
        FROM Events e
        JOIN Users u ON e.organizer_id = u.user_id
        WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
        queryStr += ` AND e.status = ?`;
        params.push(status);
    }

    if (from_date) {
        queryStr += ` AND e.event_date >= ?`;
        params.push(from_date);
    }

    if (to_date) {
        queryStr += ` AND e.event_date <= ?`;
        params.push(to_date);
    }

    // Parse limit and add to query string directly to avoid parameter binding issue
    const limitValue = parseInt(limit) || 100;
    queryStr += ` ORDER BY e.event_date ASC LIMIT ${limitValue}`;

    const events = await query(queryStr, params);

    // Add attendee counts
    for (let event of events) {
        const [rsvpData] = await query(
            `SELECT 
                COUNT(CASE WHEN status = 'going' THEN 1 END) as going_count,
                COUNT(CASE WHEN status = 'interested' THEN 1 END) as interested_count
             FROM RSVPs 
             WHERE event_id = ?`,
            [event.event_id]
        );
        event.going_count = rsvpData?.going_count || 0;
        event.interested_count = rsvpData?.interested_count || 0;
    }

    res.json({ success: true, events, count: events.length });
}));

// ------------------------------
// GET a single event by ID
// ------------------------------
router.get('/:event_id', asyncHandler(async (req, res) => {
    const { event_id } = req.params;

    const events = await query(
        `SELECT e.*, u.name AS organizer_name 
         FROM Events e
         JOIN Users u ON e.organizer_id = u.user_id
         WHERE e.event_id = ?`,
        [event_id]
    );

    if (events.length === 0)
        return res.status(404).json({ success: false, error: "Event not found" });

    res.json({ success: true, event: events[0] });
}));

// ------------------------------
// CREATE a new event
// Requires logged-in user
// ------------------------------
// ------------------------------
// CREATE a new event
// Requires logged-in user
// ------------------------------
router.post('/', asyncHandler(async (req, res) => {
    const user_id = req.user?.user_id;
    if (!user_id) return res.status(401).json({ error: "Unauthorized" });

    const { title, description, event_date, location, location_lat, location_lng, max_attendees } = req.body;
    if (!title || !event_date)
        return res.status(400).json({ error: "Missing required fields" });

    // Create post
    const postResult = await query(
        `INSERT INTO Posts (user_id, content, post_type)
         VALUES (?, ?, ?)`,
        [
            user_id,
            `Event: ${title}${description ? '\n' + description : ''}`,
            'event'
        ]
    );
    const post_id = postResult.insertId;

    // Create event
    const eventResult = await query(
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
    const event_id = eventResult.insertId;

    // Get the newly created event with organizer info
    const newEvents = await query(
        `SELECT e.*, u.name AS organizer_name, u.profile_image_url AS organizer_image
         FROM Events e
         JOIN Users u ON e.organizer_id = u.user_id
         WHERE e.event_id = ?`,
        [event_id]
    );

    if (newEvents.length === 0) {
        return res.status(500).json({ error: 'Failed to retrieve created event' });
    }

    res.json({ success: true, event: newEvents[0] });
}));



// ------------------------------
// UPDATE an event
// Only organizer can update
// ------------------------------
router.put('/:event_id', asyncHandler(async (req, res) => {
    const user_id = req.user?.user_id;
    const { event_id } = req.params;

    const [event] = await query(
        `SELECT * FROM Events WHERE event_id = ?`,
        [event_id]
    );

    if (!event)
        return res.status(404).json({ error: "Event not found" });

    if (event.organizer_id !== user_id)
        return res.status(403).json({ error: "Forbidden" });

    const {
        title,
        description,
        event_date,
        location,
        location_lat,
        location_lng,
        max_attendees,
        status
    } = req.body;

    await query(
        `UPDATE Events SET
         title = COALESCE(?, title),
         description = COALESCE(?, description),
         event_date = COALESCE(?, event_date),
         location = COALESCE(?, location),
         location_lat = COALESCE(?, location_lat),
         location_lng = COALESCE(?, location_lng),
         max_attendees = COALESCE(?, max_attendees),
         status = COALESCE(?, status)
         WHERE event_id = ?`,
        [
            title ?? null,
            description ?? null,
            event_date ?? null,
            location ?? null,
            location_lat ?? null,
            location_lng ?? null,
            max_attendees ?? null,
            status ?? null,
            event_id
        ]
    );

    const [updated] = await query(`SELECT * FROM Events WHERE event_id = ?`, [event_id]);

    res.json({ success: true, event: updated });
}));

// ------------------------------
// DELETE an event
// ------------------------------
router.delete('/:event_id', asyncHandler(async (req, res) => {
    const user_id = req.user?.user_id;
    const { event_id } = req.params;

    const [event] = await query(
        `SELECT * FROM Events WHERE event_id = ?`,
        [event_id]
    );

    if (!event)
        return res.status(404).json({ error: "Event not found" });

    if (event.organizer_id !== user_id)
        return res.status(403).json({ error: "Forbidden" });

    await query(`DELETE FROM Events WHERE event_id = ?`, [event_id]);

    res.json({ success: true });
}));

// ------------------------------
<<<<<<< HEAD
// Add comment to an event (posts comments on associated post)
// POST /api/events/:event_id/comment
// ------------------------------
router.post('/:event_id/comment', asyncHandler(async (req, res) => {
    const { event_id } = req.params;
    const { content } = req.body;

    if (!req.user?.user_id) return res.status(401).json({ error: 'Unauthorized' });
    if (!content || content.trim().length === 0) return res.status(400).json({ error: 'Content cannot be empty' });

    // Find event and its post_id
    const events = await query('SELECT post_id FROM Events WHERE event_id = ?', [event_id]);
    if (!events || events.length === 0) return res.status(404).json({ success: false, error: 'Event not found' });

    const post_id = events[0].post_id;

    // Insert into Comments table linked to the post
    const result = await query('INSERT INTO Comments (post_id, user_id, content) VALUES (?, ?, ?)', [post_id, req.user.user_id, content.trim()]);

    // Increment posts comments count if you track it
    await query('UPDATE Posts SET comments_count = COALESCE(comments_count, 0) + 1 WHERE post_id = ?', [post_id]);

    res.json({ success: true, message: 'Comment added to event', comment_id: result.insertId });
=======
// RSVP to an event
// ------------------------------
router.post('/:event_id/rsvp', asyncHandler(async (req, res) => {
    const user_id = req.user?.user_id;
    const { event_id } = req.params;
    const { status } = req.body; // "going", "interested", "not_going"

    if (!user_id) return res.status(401).json({ error: "Unauthorized" });
    if (!['going', 'interested', 'not_going'].includes(status))
        return res.status(400).json({ error: "Invalid RSVP status" });

    // Insert or update RSVP
    await query(
        `INSERT INTO RSVPs (event_id, user_id, status) 
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE status = ?`,
        [event_id, user_id, status, status]
    );

    // Optionally update current_attendees count
    const [{ count }] = await query(
        `SELECT COUNT(*) AS count FROM RSVPs WHERE event_id = ? AND status = 'going'`,
        [event_id]
    );

    await query(`UPDATE Events SET current_attendees = ? WHERE event_id = ?`, [count, event_id]);

    res.json({ success: true, status, current_attendees: count });
}));

// ------------------------------
// Get user's RSVP for an event
// ------------------------------
router.get('/:event_id/rsvp', asyncHandler(async (req, res) => {
    const user_id = req.user?.user_id;
    const { event_id } = req.params;

    if (!user_id) return res.status(401).json({ error: "Unauthorized" });

    const [rsvp] = await query(
        `SELECT * FROM RSVPs WHERE event_id = ? AND user_id = ?`,
        [event_id, user_id]
    );

    res.json({ success: true, rsvp: rsvp || null });
>>>>>>> 39e69a7049dbd69288cbe9c2a7f9e101d8fbef98
}));

module.exports = router;
