const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/error.middleware');
const { checkAndAwardBadges } = require('../utils/badges');

// Send trusted contact request
router.post('/request', asyncHandler(async (req, res) => {
  const { trusted_user_id } = req.body;

  if (!req.user?.user_id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!trusted_user_id) {
    return res.status(400).json({ error: 'trusted_user_id is required' });
  }

  if (req.user.user_id === trusted_user_id) {
    return res.status(400).json({ error: 'Cannot add yourself as a trusted contact' });
  }

  // Check if user exists
  const users = await query(
    'SELECT user_id FROM Users WHERE user_id = ?',
    [trusted_user_id]
  );

  if (users.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Check if contact already exists
  const existingContacts = await query(
    'SELECT * FROM TrustedContacts WHERE user_id = ? AND trusted_user_id = ?',
    [req.user.user_id, trusted_user_id]
  );

  if (existingContacts.length > 0) {
    return res.status(400).json({ 
      error: 'Contact request already exists',
      status: existingContacts[0].status
    });
  }

  // Create contact request
  await query(
    'INSERT INTO TrustedContacts (user_id, trusted_user_id, status) VALUES (?, ?, ?)',
    [req.user.user_id, trusted_user_id, 'pending']
  );

  // Create notification
  await query(
    `INSERT INTO Notifications (user_id, type, title, content, related_id, related_type)
     VALUES (?, 'system', 'Trusted Contact Request', 'Someone wants to add you as a trusted contact', ?, 'user')`,
    [trusted_user_id, req.user.user_id]
  );

  res.json({
    success: true,
    message: 'Contact request sent'
  });
}));

// Get user's trusted contacts
router.get('/my-contacts', asyncHandler(async (req, res) => {
  if (!req.user?.user_id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const contacts = await query(
    `SELECT tc.*, 
            u.user_id, u.display_name, u.username, u.profile_image_url, 
            u.verification_status, u.street
     FROM TrustedContacts tc
     JOIN Users u ON tc.trusted_user_id = u.user_id
     WHERE tc.user_id = ? AND tc.status = 'accepted'
     ORDER BY u.display_name`,
    [req.user.user_id]
  );

  res.json({
    success: true,
    contacts,
    count: contacts.length
  });
}));

// Get pending contact requests (received)
router.get('/requests', asyncHandler(async (req, res) => {
  if (!req.user?.user_id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const requests = await query(
    `SELECT tc.*, 
            u.user_id, u.display_name, u.username, u.profile_image_url, 
            u.verification_status
     FROM TrustedContacts tc
     JOIN Users u ON tc.user_id = u.user_id
     WHERE tc.trusted_user_id = ? AND tc.status = 'pending'
     ORDER BY tc.created_at DESC`,
    [req.user.user_id]
  );

  res.json({
    success: true,
    requests,
    count: requests.length
  });
}));

// Accept contact request
router.patch('/:contactId/accept', asyncHandler(async (req, res) => {
  const { contactId } = req.params;

  if (!req.user?.user_id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify the request is for this user
  const contacts = await query(
    'SELECT * FROM TrustedContacts WHERE contact_id = ?',
    [contactId]
  );

  if (contacts.length === 0) {
    return res.status(404).json({ error: 'Contact request not found' });
  }

  if (contacts[0].trusted_user_id !== req.user.user_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (contacts[0].status !== 'pending') {
    return res.status(400).json({ error: 'Request already processed' });
  }

  // Accept the request
  await query(
    'UPDATE TrustedContacts SET status = ? WHERE contact_id = ?',
    ['accepted', contactId]
  );

  // Create reciprocal contact
  await query(
    'INSERT INTO TrustedContacts (user_id, trusted_user_id, status) VALUES (?, ?, ?)',
    [req.user.user_id, contacts[0].user_id, 'accepted']
  );

  // Notify the requester
  await query(
    `INSERT INTO Notifications (user_id, type, title, content, related_id, related_type)
     VALUES (?, 'system', 'Contact Request Accepted', 'Your trusted contact request was accepted', ?, 'user')`,
    [contacts[0].user_id, req.user.user_id]
  );

  // Check and award badges for both users
  await checkAndAwardBadges(req.user.user_id);
  await checkAndAwardBadges(contacts[0].user_id);

  res.json({
    success: true,
    message: 'Contact request accepted'
  });
}));

// Reject contact request
router.patch('/:contactId/reject', asyncHandler(async (req, res) => {
  const { contactId } = req.params;

  if (!req.user?.user_id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify the request is for this user
  const contacts = await query(
    'SELECT * FROM TrustedContacts WHERE contact_id = ?',
    [contactId]
  );

  if (contacts.length === 0) {
    return res.status(404).json({ error: 'Contact request not found' });
  }

  if (contacts[0].trusted_user_id !== req.user.user_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Delete the request
  await query('DELETE FROM TrustedContacts WHERE contact_id = ?', [contactId]);

  res.json({
    success: true,
    message: 'Contact request rejected'
  });
}));

// Block a contact
router.patch('/:contactId/block', asyncHandler(async (req, res) => {
  const { contactId } = req.params;

  if (!req.user?.user_id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify the contact belongs to this user
  const contacts = await query(
    'SELECT * FROM TrustedContacts WHERE contact_id = ?',
    [contactId]
  );

  if (contacts.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  if (contacts[0].user_id !== req.user.user_id && contacts[0].trusted_user_id !== req.user.user_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Block the contact
  await query(
    'UPDATE TrustedContacts SET status = ? WHERE contact_id = ?',
    ['blocked', contactId]
  );

  // Also block reciprocal contact if exists
  await query(
    'UPDATE TrustedContacts SET status = ? WHERE user_id = ? AND trusted_user_id = ?',
    ['blocked', contacts[0].trusted_user_id, contacts[0].user_id]
  );

  res.json({
    success: true,
    message: 'Contact blocked'
  });
}));

// Remove/delete a trusted contact
router.delete('/:contactId', asyncHandler(async (req, res) => {
  const { contactId } = req.params;

  if (!req.user?.user_id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify the contact belongs to this user
  const contacts = await query(
    'SELECT * FROM TrustedContacts WHERE contact_id = ?',
    [contactId]
  );

  if (contacts.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  if (contacts[0].user_id !== req.user.user_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Delete the contact
  await query('DELETE FROM TrustedContacts WHERE contact_id = ?', [contactId]);

  // Also delete reciprocal contact if exists
  await query(
    'DELETE FROM TrustedContacts WHERE user_id = ? AND trusted_user_id = ?',
    [contacts[0].trusted_user_id, contacts[0].user_id]
  );

  res.json({
    success: true,
    message: 'Contact removed'
  });
}));

module.exports = router;
