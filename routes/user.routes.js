const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/error.middleware');

/// get route
router.get('/profile', asyncHandler(async (req, res) => {
    const users = await query('SELECT user_id, email, name, age, occupation, bio, address, street, verification_status, profile_visibility, is_moderator, created_at FROM Users WHERE user_id = ?', [req.user.user_id]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user: users[0] });
}));

router.put('/profile', asyncHandler(async (req, res) => {
  // req.user.user_id should come from auth middleware
  const { name, bio, street, occupation, age } = req.body;

  if (!req.user?.user_id) return res.status(401).json({ error: 'Unauthorized' });

  await query(
      `UPDATE Users
       SET name = COALESCE(?, name),
           bio = COALESCE(?, bio),
           street = COALESCE(?, street),
           occupation = COALESCE(?, occupation),
           age = COALESCE(?, age)
       WHERE user_id = ?`,
      [name ?? null, bio ?? null, street ?? null, occupation ?? null, age ?? null, req.user.user_id]
  );

  const [updatedUser] = await query('SELECT * FROM Users WHERE user_id = ?', [req.user.user_id]);
  res.json({ success: true, user: updatedUser });
}));



router.get('/public/:userId', asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const users = await query(`SELECT user_id, display_name, username,name,profile_image_url,bio,age,occupation,interests,skills,verification_status,created_atFROM UsersWHERE user_id = ?`,[userId]);
    if (users.length === 0) {return res.status(404).json({ error: 'User not found' });}
    res.json({success: true, user: users[0]});
}));


module.exports = router;