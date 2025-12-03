const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/error.middleware');

// Get all available badges
router.get('/', asyncHandler(async (req, res) => {
  const badges = await query(
    'SELECT * FROM Badges ORDER BY tier, name'
  );

  res.json({
    success: true,
    badges
  });
}));

// Get user's earned badges (public - only displayed badges)
router.get('/user/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const userBadges = await query(
    `SELECT ub.user_badge_id, ub.user_id, ub.badge_id, ub.earned_at, ub.is_displayed,
            b.name, b.description, b.icon, b.category, b.points_value, b.tier
     FROM UserBadges ub
     JOIN Badges b ON ub.badge_id = b.badge_id
     WHERE ub.user_id = ? AND ub.is_displayed = TRUE
     ORDER BY ub.earned_at DESC`,
    [userId]
  );

  res.json({
    success: true,
    badges: userBadges,
    count: userBadges.length
  });
}));

// Get authenticated user's badges
router.get('/my-badges', asyncHandler(async (req, res) => {
  if (!req.user?.user_id) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const userBadges = await query(
    `SELECT ub.user_badge_id, ub.user_id, ub.badge_id, ub.earned_at, ub.is_displayed,
            b.name, b.description, b.icon, b.category, b.points_value, b.tier
     FROM UserBadges ub
     JOIN Badges b ON ub.badge_id = b.badge_id
     WHERE ub.user_id = ?
     ORDER BY ub.earned_at DESC`,
    [req.user.user_id]
  );

  res.json({
    success: true,
    badges: userBadges,
    count: userBadges.length
  });
}));

// Toggle badge display
router.patch('/:badgeId/display', asyncHandler(async (req, res) => {
  const { badgeId } = req.params;
  const { is_displayed } = req.body;

  if (!req.user?.user_id) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Verify user has this badge
  const userBadges = await query(
    'SELECT * FROM UserBadges WHERE user_id = ? AND badge_id = ?',
    [req.user.user_id, badgeId]
  );

  if (userBadges.length === 0) {
    return res.status(404).json({ success: false, message: 'Badge not found or not earned' });
  }

  await query(
    'UPDATE UserBadges SET is_displayed = ? WHERE user_id = ? AND badge_id = ?',
    [is_displayed ? 1 : 0, req.user.user_id, badgeId]
  );

  res.json({
    success: true,
    message: 'Badge display status updated'
  });
}));

// Get badge progress for user (optional - for gamification)
router.get('/progress', asyncHandler(async (req, res) => {
  if (!req.user?.user_id) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const userId = req.user.user_id;

  // Get all badges and check which ones user has
  const allBadges = await query('SELECT * FROM Badges');
  const earnedBadges = await query(
    'SELECT badge_id FROM UserBadges WHERE user_id = ?',
    [userId]
  );

  const earnedBadgeIds = earnedBadges.map(b => b.badge_id);

  // Get user stats for progress calculation
  const [userStats] = await query(
    `SELECT 
       (SELECT COUNT(*) FROM Posts WHERE user_id = ?) as post_count,
       (SELECT COUNT(*) FROM IncidentReports ir 
        JOIN Posts p ON ir.post_id = p.post_id 
        WHERE p.user_id = ? AND ir.verification_status = 'verified') as verified_incidents,
       (SELECT COUNT(*) FROM Events WHERE organizer_id = ?) as events_organized,
       (SELECT COUNT(*) FROM TrustedContacts WHERE user_id = ? AND status = 'accepted') as trusted_contacts,
       (SELECT COUNT(*) FROM ChatMessages WHERE user_id = ?) as messages_sent
    `,
    [userId, userId, userId, userId, userId]
  );

  const progress = allBadges.map(badge => {
    const earned = earnedBadgeIds.includes(badge.badge_id);
    let currentProgress = 0;
    let targetProgress = 0;

    // Calculate progress based on badge name (this is simplified)
    if (badge.name === 'First Post') {
      currentProgress = userStats.post_count >= 1 ? 1 : 0;
      targetProgress = 1;
    } else if (badge.name === 'Active Member') {
      currentProgress = userStats.post_count;
      targetProgress = 50;
    } else if (badge.name === 'Safety Champion') {
      currentProgress = userStats.verified_incidents;
      targetProgress = 10;
    } else if (badge.name === 'Event Organizer') {
      currentProgress = userStats.events_organized;
      targetProgress = 5;
    } else if (badge.name === 'Trusted Neighbor') {
      currentProgress = userStats.trusted_contacts;
      targetProgress = 10;
    } else if (badge.name === 'Chat Leader') {
      currentProgress = userStats.messages_sent;
      targetProgress = 100;
    }

    return {
      ...badge,
      earned,
      progress: {
        current: currentProgress,
        target: targetProgress,
        percentage: targetProgress > 0 ? Math.min((currentProgress / targetProgress) * 100, 100) : 0
      }
    };
  });

  res.json({
    success: true,
    badges: progress,
    stats: userStats
  });
}));

module.exports = router;
