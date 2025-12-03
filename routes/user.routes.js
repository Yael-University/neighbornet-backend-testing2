const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/error.middleware');

// Configure multer for profile image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/profiles');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename: userId_timestamp.ext
    const ext = path.extname(file.originalname);
    const filename = `${req.user.user_id}_${Date.now()}${ext}`;
    cb(null, filename);
  }
});

// File filter to allow only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

/// get route
router.get('/profile', asyncHandler(async (req, res) => {
    const users = await query('SELECT user_id, email, name, username, display_name, age, occupation, bio, address, street, verification_status, profile_visibility, is_moderator, created_at FROM Users WHERE user_id = ?', [req.user.user_id]);
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
    const users = await query(`SELECT user_id, display_name, username, name, profile_image_url, bio, age,
                                      occupation, interests, skills, verification_status, created_at
                               FROM Users
                               WHERE user_id = ?
    `,[userId]);
    if (users.length === 0) {return res.status(404).json({ error: 'User not found' });}
    res.json({success: true, user: users[0]});
}));

// Upload profile image
router.post('/profile/image', upload.single('profile_image'), asyncHandler(async (req, res) => {
  if (!req.user?.user_id) return res.status(401).json({ error: 'Unauthorized' });

  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  // Get the old profile image URL to delete it if it exists
  const users = await query('SELECT profile_image_url FROM Users WHERE user_id = ?', [req.user.user_id]);
  
  if (users.length > 0 && users[0].profile_image_url) {
    // Extract filename from URL and delete old file
    const oldFilename = path.basename(users[0].profile_image_url);
    const oldFilePath = path.join(__dirname, '../uploads/profiles', oldFilename);
    
    if (fs.existsSync(oldFilePath)) {
      fs.unlinkSync(oldFilePath);
    }
  }

  // Generate URL for the new image
  const imageUrl = `/uploads/profiles/${req.file.filename}`;

  // Update user's profile image URL in database
  await query(
    'UPDATE Users SET profile_image_url = ? WHERE user_id = ?',
    [imageUrl, req.user.user_id]
  );

  res.json({
    success: true,
    message: 'Profile image uploaded successfully',
    profile_image_url: imageUrl
  });
}));

module.exports = router;
