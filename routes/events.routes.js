const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/error.middleware');

// ------------------------------
// GET all events
// ------------------------------
router.get('/', asyncHandler(async (req, res) => {
    const events = await query(
        `SELECT e.*, u.name AS organizer_name 
         FROM Events e
         JOIN Users u ON e.organizer_id = u.user_id
         ORDER BY e.event_date ASC`
    );

    res.json({ success: true, events });
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
    const result = await query(
        `INSERT INTO Posts (user_id, content, post_type)
         VALUES (?, ?, ?)`,
        [
            user_id,
            `Event: ${title}${description ? '\n' + description : ''}`,
            'event'
        ]
    );
    const post_id = result.insertId;

    // Create event
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
        `SELECT e.*, u.name AS organizer_name
         FROM Events e
                  JOIN Users u ON e.organizer_id = u.user_id
         WHERE e.post_id = ?`,
        [post_id]
    );

    res.json({ success: true, event: newEvent });
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
}));

module.exports = router;
