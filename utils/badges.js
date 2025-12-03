const { query } = require('../config/database');

/**
 * Check and award badges to a user based on their current stats
 * @param {number} userId - The user ID to check badges for
 * @returns {Promise<Array>} Array of newly awarded badges
 */
async function checkAndAwardBadges(userId) {
  try {
    // Get all badges with their criteria
    const badges = await query(
      `SELECT badge_id, name, criteria_type, criteria_value 
       FROM Badges 
       WHERE criteria_type IS NOT NULL`
    );

    // Get user's current stats
    const [userStats] = await query(
      `SELECT 
        (SELECT COUNT(*) FROM Posts WHERE user_id = ? AND status = 'active') as post_count,
        (SELECT COUNT(*) FROM Comments WHERE user_id = ?) as comment_count,
        (SELECT COUNT(*) FROM Likes WHERE post_id IN (SELECT post_id FROM Posts WHERE user_id = ?)) as likes_received,
        (SELECT COUNT(*) FROM EventSignups WHERE user_id = ?) as events_attended,
        (SELECT COUNT(*) FROM Events WHERE organizer_id = ?) as events_created,
        (SELECT COUNT(*) FROM IncidentReports ir JOIN Posts p ON ir.post_id = p.post_id WHERE p.user_id = ?) as incidents_reported,
        (SELECT COUNT(*) FROM TrustedContacts WHERE user_id = ? AND status = 'accepted') as trusted_contacts`,
      [userId, userId, userId, userId, userId, userId, userId]
    );

    // Get badges user already has
    const earnedBadges = await query(
      'SELECT badge_id FROM UserBadges WHERE user_id = ?',
      [userId]
    );
    const earnedBadgeIds = earnedBadges.map(b => b.badge_id);

    const newlyAwardedBadges = [];

    // Check each badge's criteria
    for (const badge of badges) {
      // Skip if user already has this badge
      if (earnedBadgeIds.includes(badge.badge_id)) {
        continue;
      }

      let meetsRequirement = false;

      // Check if user meets the criteria
      switch (badge.criteria_type) {
        case 'post_count':
          meetsRequirement = userStats.post_count >= badge.criteria_value;
          break;
        case 'comment_count':
          meetsRequirement = userStats.comment_count >= badge.criteria_value;
          break;
        case 'likes_received':
          meetsRequirement = userStats.likes_received >= badge.criteria_value;
          break;
        case 'events_attended':
          meetsRequirement = userStats.events_attended >= badge.criteria_value;
          break;
        case 'events_created':
          meetsRequirement = userStats.events_created >= badge.criteria_value;
          break;
        case 'incidents_reported':
          meetsRequirement = userStats.incidents_reported >= badge.criteria_value;
          break;
        case 'trusted_contacts':
          meetsRequirement = userStats.trusted_contacts >= badge.criteria_value;
          break;
      }

      // Award the badge if requirement is met
      if (meetsRequirement) {
        try {
          await query(
            'INSERT INTO UserBadges (user_id, badge_id) VALUES (?, ?)',
            [userId, badge.badge_id]
          );

          // Create notification for badge award
          await query(
            `INSERT INTO Notifications (user_id, type, title, content, related_id, related_type)
             VALUES (?, 'badge', 'New Badge Earned!', ?, ?, 'user')`,
            [userId, `You've earned the "${badge.name}" badge!`, badge.badge_id]
          );

          newlyAwardedBadges.push(badge);
        } catch (err) {
          // Ignore duplicate key errors (badge already awarded)
          if (err.code !== 'ER_DUP_ENTRY') {
            console.error('Error awarding badge:', err);
          }
        }
      }
    }

    return newlyAwardedBadges;
  } catch (error) {
    console.error('Error in checkAndAwardBadges:', error);
    return [];
  }
}

module.exports = {
  checkAndAwardBadges
};
