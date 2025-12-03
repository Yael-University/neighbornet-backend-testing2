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
    const users = await query('SELECT user_id, email, name, username, display_name, age, occupation, bio, address, street, verification_status, profile_visibility, is_moderator, profile_image_url, created_at FROM Users WHERE user_id = ?', [req.user.user_id]);
    if (users.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: users[0] });
}));

router.put('/profile', asyncHandler(async (req, res) => {
  if (!req.user?.user_id) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const userId = req.user.user_id;
  const { name, display_name, username, bio, street, email, phone, occupation, age } = req.body;

  // Validation: Required fields
  if (!name || !name.trim()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Name is required' 
    });
  }

  if (!display_name || !display_name.trim()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Display name is required' 
    });
  }

  if (!username || !username.trim()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username is required' 
    });
  }

  // Validation: Username minimum length
  if (username.trim().length < 3) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username must be at least 3 characters' 
    });
  }

  // Check if username is already taken (by another user)
  const existingUsername = await query(
    'SELECT user_id FROM Users WHERE username = ? AND user_id != ?',
    [username.trim().toLowerCase(), userId]
  );

  if (existingUsername.length > 0) {
    return res.status(409).json({ 
      success: false, 
      message: 'Username is already taken' 
    });
  }

  // Validate email format if provided
  if (email && email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
    }

    // Check if email is already taken (by another user)
    const existingEmail = await query(
      'SELECT user_id FROM Users WHERE email = ? AND user_id != ?',
      [email.trim(), userId]
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'Email is already in use' 
      });
    }
  }

  // Update user profile
  await query(
    `UPDATE Users 
     SET 
       name = ?,
       display_name = ?,
       username = ?,
       bio = ?,
       street = ?,
       email = ?,
       occupation = ?,
       age = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [
      name.trim(),
      display_name.trim(),
      username.trim().toLowerCase(), // Store username in lowercase
      bio ? bio.trim() : null,
      street ? street.trim() : null,
      email ? email.trim() : null,
      occupation ? occupation.trim() : null,
      age || null,
      userId
    ]
  );

  // Fetch updated user data (select specific fields for security)
  const [updatedUser] = await query(
    `SELECT user_id, name, display_name, username, email, bio, street, 
     occupation, age, profile_image_url, verification_status, created_at, updated_at 
     FROM Users WHERE user_id = ?`,
    [userId]
  );

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: updatedUser
  });
}));



router.get('/public/:userId', asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const users = await query(`SELECT user_id, display_name, username, name, profile_image_url, bio, age,
                                      occupation, interests, skills, verification_status, created_at
                               FROM Users
                               WHERE user_id = ?
    `,[userId]);
    if (users.length === 0) {return res.status(404).json({ success: false, message: 'User not found' });}
    res.json({success: true, user: users[0]});
}));

// Request verification
router.post('/verify/request', asyncHandler(async (req, res) => {
  if (!req.user?.user_id) return res.status(401).json({ success: false, message: 'Unauthorized' });

  // Check current verification status
  const users = await query(
    'SELECT verification_status FROM Users WHERE user_id = ?',
    [req.user.user_id]
  );

  if (users.length === 0) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (users[0].verification_status === 'verified') {
    return res.status(400).json({ success: false, message: 'User is already verified' });
  }

  if (users[0].verification_status === 'pending') {
    return res.status(400).json({ success: false, message: 'Verification request already pending' });
  }

  // Update verification status to pending
  await query(
    'UPDATE Users SET verification_status = ? WHERE user_id = ?',
    ['pending', req.user.user_id]
  );

  // Create notification for moderators (optional - you can implement this later)
  res.json({
    success: true,
    message: 'Verification request submitted successfully'
  });
}));

// Admin/Moderator: Verify a user
router.post('/admin/users/:userId/verify', asyncHandler(async (req, res) => {
  if (!req.user?.user_id) return res.status(401).json({ success: false, message: 'Unauthorized' });

  // Check if requester is moderator
  const moderators = await query(
    'SELECT is_moderator FROM Users WHERE user_id = ?',
    [req.user.user_id]
  );

  if (moderators.length === 0 || !moderators[0].is_moderator) {
    return res.status(403).json({ success: false, message: 'Forbidden - Admin/Moderator access required' });
  }

  const { userId } = req.params;

  // Check if target user exists
  const users = await query(
    'SELECT user_id, name FROM Users WHERE user_id = ?',
    [userId]
  );

  if (users.length === 0) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Update user's verification status to verified
  await query(
    'UPDATE Users SET verification_status = ? WHERE user_id = ?',
    ['verified', userId]
  );

  // Create notification for the verified user
  await query(
    `INSERT INTO Notifications (user_id, type, title, content, priority)
     VALUES (?, 'system', 'Account Verified', 'Your account has been verified!', 'normal')`,
    [userId]
  );

  res.json({
    success: true,
    message: 'User verified successfully'
  });
}));

// Upload profile image
router.post('/profile/image', upload.single('profile_image'), asyncHandler(async (req, res) => {
  if (!req.user?.user_id) return res.status(401).json({ success: false, message: 'Unauthorized' });

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file provided' });
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

  // Generate full URL for the new image using request host
  // This ensures mobile devices can access the image with the actual server IP
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/profiles/${req.file.filename}`;

  // Update user's profile image URL in database
  await query(
    'UPDATE Users SET profile_image_url = ? WHERE user_id = ?',
    [imageUrl, req.user.user_id]
  );

  res.json({
    success: true,
    message: 'Profile image uploaded successfully',
    image_url: imageUrl,
    profile_image: imageUrl,
    profile_image_url: imageUrl
  });
}));

module.exports = router;
