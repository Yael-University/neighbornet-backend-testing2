-- Disable foreign key checks to allow dropping tables in any order
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS MessageReactions;
DROP TABLE IF EXISTS NotificationTokens;
DROP TABLE IF EXISTS Likes;
DROP TABLE IF EXISTS Notifications;
DROP TABLE IF EXISTS TrustedContacts;
DROP TABLE IF EXISTS UserBadges;
DROP TABLE IF EXISTS Badges;
DROP TABLE IF EXISTS PostTags;
DROP TABLE IF EXISTS Tags;
DROP TABLE IF EXISTS ChatMessages;
DROP TABLE IF EXISTS GroupMemberships;
DROP TABLE IF EXISTS UserGroups;
DROP TABLE IF EXISTS Verifications;
DROP TABLE IF EXISTS IncidentReports;
DROP TABLE IF EXISTS EventSignups;
DROP TABLE IF EXISTS RSVPs;
DROP TABLE IF EXISTS Events;
DROP TABLE IF EXISTS Comments;
DROP TABLE IF EXISTS Posts;
DROP TABLE IF EXISTS Follows;
DROP TABLE IF EXISTS DirectMessages;
DROP TABLE IF EXISTS Users;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE Users (
user_id INT PRIMARY KEY AUTO_INCREMENT,
email VARCHAR(255) UNIQUE NOT NULL,
password_hash VARCHAR(255) NOT NULL,
name VARCHAR(100) NOT NULL,
display_name VARCHAR(100) NOT NULL,
username VARCHAR(100) UNIQUE NOT NULL,
phone VARCHAR(50),
age INT,
occupation VARCHAR(100),
skills TEXT,
interests TEXT,
bio TEXT,
address VARCHAR(255),
street VARCHAR(100),
latitude DECIMAL(10,8),
longitude DECIMAL(11,8),
verification_status ENUM('unverified','pending','verified') DEFAULT 'unverified',
profile_visibility ENUM('public','neighborhood','private') DEFAULT 'neighborhood',
is_moderator BOOLEAN DEFAULT FALSE,
profile_image_url VARCHAR(500),
email_verified BOOLEAN DEFAULT FALSE,
verification_token VARCHAR(255),
verification_token_expires DATETIME,
reset_password_token VARCHAR(255),
reset_password_expires DATETIME,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
last_login TIMESTAMP NULL,
INDEX idx_email (email),
INDEX idx_username (username),
INDEX idx_street (street),
INDEX idx_verification_token (verification_token),
INDEX idx_reset_token (reset_password_token)
);

CREATE TABLE Posts (
post_id INT PRIMARY KEY AUTO_INCREMENT,
user_id INT NOT NULL,
content TEXT NOT NULL,
post_type ENUM('incident', 'event', 'help', 'question', 'review', 'poll', 'announcement', 'general') DEFAULT 'general',
priority ENUM('normal', 'high', 'urgent') DEFAULT 'normal',
is_verified BOOLEAN DEFAULT FALSE,
media_urls TEXT,
post_image VARCHAR(500),
location_lat DECIMAL(10, 8),
location_lng DECIMAL(11, 8),
visibility_radius INT DEFAULT 5000,
likes_count INT DEFAULT 0,
comments_count INT DEFAULT 0,
is_pinned BOOLEAN DEFAULT FALSE,
status ENUM('active', 'archived', 'reported', 'removed') DEFAULT 'active',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
INDEX idx_user (user_id),
INDEX idx_post_type (post_type),
INDEX idx_created (created_at),
INDEX idx_location (location_lat, location_lng)
);

CREATE TABLE Events (
event_id INT PRIMARY KEY AUTO_INCREMENT,
post_id INT UNIQUE NOT NULL,
title VARCHAR(255) NOT NULL,
description TEXT,
event_date DATETIME NOT NULL,
location VARCHAR(255),
location_lat DECIMAL(10, 8),
location_lng DECIMAL(11, 8),
poi VARCHAR(255),
max_attendees INT,
current_attendees INT DEFAULT 0,
organizer_id INT NOT NULL,
status ENUM('upcoming', 'ongoing', 'completed', 'cancelled') DEFAULT 'upcoming',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE,
FOREIGN KEY (organizer_id) REFERENCES Users(user_id) ON DELETE CASCADE,
INDEX idx_event_date (event_date),
INDEX idx_organizer (organizer_id)
);

CREATE TABLE RSVPs (
rsvp_id INT PRIMARY KEY AUTO_INCREMENT,
event_id INT NOT NULL,
user_id INT NOT NULL,
status ENUM('going', 'interested', 'not_going') DEFAULT 'going',
reminder_sent BOOLEAN DEFAULT FALSE,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (event_id) REFERENCES Events(event_id) ON DELETE CASCADE,
FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
UNIQUE KEY unique_rsvp (event_id, user_id),
INDEX idx_event (event_id),
INDEX idx_user (user_id)
);

CREATE TABLE EventSignups (
signup_id INT PRIMARY KEY AUTO_INCREMENT,
event_id INT NOT NULL,
user_id INT NOT NULL,
signed_up_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (event_id) REFERENCES Events(event_id) ON DELETE CASCADE,
FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
UNIQUE KEY unique_signup (event_id, user_id),
INDEX idx_event (event_id),
INDEX idx_user (user_id)
);

CREATE TABLE IncidentReports (
incident_id INT PRIMARY KEY AUTO_INCREMENT,
post_id INT UNIQUE NOT NULL,
incident_type ENUM('suspicious_activity', 'break_in', 'vandalism', 'noise', 'traffic', 'other') NOT NULL,
severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
verification_status ENUM('pending', 'verified', 'false_report', 'under_review') DEFAULT 'pending',
verified_by INT,
verified_at TIMESTAMP NULL,
location_description TEXT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE,
FOREIGN KEY (verified_by) REFERENCES Users(user_id) ON DELETE SET NULL,
INDEX idx_verification_status (verification_status),
INDEX idx_incident_type (incident_type)
);

CREATE TABLE Verifications (
verification_id INT PRIMARY KEY AUTO_INCREMENT,
incident_id INT NOT NULL,
moderator_id INT NOT NULL,
decision ENUM('verified', 'rejected', 'needs_more_info') NOT NULL,
notes TEXT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (incident_id) REFERENCES IncidentReports(incident_id) ON DELETE CASCADE,
FOREIGN KEY (moderator_id) REFERENCES Users(user_id) ON DELETE CASCADE,
INDEX idx_incident (incident_id),
INDEX idx_moderator (moderator_id)
);

CREATE TABLE UserGroups (
group_id INT PRIMARY KEY AUTO_INCREMENT,
name VARCHAR(100) NOT NULL,
description TEXT,
group_type ENUM('street', 'block', 'neighborhood', 'interest') DEFAULT 'street',
street_name VARCHAR(100),
is_private BOOLEAN DEFAULT TRUE,
created_by INT NOT NULL,
member_count INT DEFAULT 0,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (created_by) REFERENCES Users(user_id) ON DELETE CASCADE,
INDEX idx_street (street_name),
INDEX idx_type (group_type)
);

CREATE TABLE GroupMemberships (
membership_id INT PRIMARY KEY AUTO_INCREMENT,
group_id INT NOT NULL,
user_id INT NOT NULL,
role ENUM('admin', 'moderator', 'member') DEFAULT 'member',
status ENUM('active', 'pending', 'removed', 'invited', 'rejected') DEFAULT 'active',
invited_by INT NULL,
invite_created_at DATETIME NULL,
invite_id VARCHAR(128) NULL,
joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (group_id) REFERENCES UserGroups(group_id) ON DELETE CASCADE,
FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
UNIQUE KEY unique_membership (group_id, user_id),
INDEX idx_group (group_id),
INDEX idx_user (user_id),
INDEX idx_group_invite_id (invite_id)
);

CREATE TABLE ChatMessages (
message_id INT PRIMARY KEY AUTO_INCREMENT,
group_id INT NOT NULL,
user_id INT NOT NULL,
content TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
message_type ENUM('text', 'image', 'alert', 'system') DEFAULT 'text',
media_url VARCHAR(500),
media_type VARCHAR(50) NULL,
media_size INT NULL,
thumbnail_url VARCHAR(500) NULL,
duration INT NULL,
caption TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
is_read BOOLEAN DEFAULT FALSE,
edited_at TIMESTAMP NULL,
is_edited BOOLEAN DEFAULT FALSE,
reply_to_message_id INT NULL,
reply_to_content TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
reply_to_user_id INT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (group_id) REFERENCES UserGroups(group_id) ON DELETE CASCADE,
FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
INDEX idx_group (group_id),
INDEX idx_created (created_at),
INDEX idx_chat_edited (is_edited),
INDEX idx_chat_media_type (media_type),
INDEX idx_reply (reply_to_message_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE DirectMessages (
message_id INT PRIMARY KEY AUTO_INCREMENT,
sender_id INT NOT NULL,
receiver_id INT NOT NULL,
content TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
media_url VARCHAR(500),
media_type VARCHAR(50) NULL,
media_size INT NULL,
thumbnail_url VARCHAR(500) NULL,
duration INT NULL,
caption TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
is_read BOOLEAN DEFAULT FALSE,
edited_at TIMESTAMP NULL,
is_edited BOOLEAN DEFAULT FALSE,
reply_to_message_id INT NULL,
reply_to_content TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
reply_to_sender_id INT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (sender_id) REFERENCES Users(user_id) ON DELETE CASCADE,
FOREIGN KEY (receiver_id) REFERENCES Users(user_id) ON DELETE CASCADE,
INDEX idx_sender (sender_id),
INDEX idx_receiver (receiver_id),
INDEX idx_created (created_at),
INDEX idx_dm_edited (is_edited),
INDEX idx_dm_media_type (media_type),
INDEX idx_reply (reply_to_message_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE Follows (
follow_id INT PRIMARY KEY AUTO_INCREMENT,
follower_id INT NOT NULL,
followed_id INT NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (follower_id) REFERENCES Users(user_id) ON DELETE CASCADE,
FOREIGN KEY (followed_id) REFERENCES Users(user_id) ON DELETE CASCADE,
UNIQUE KEY unique_follow (follower_id, followed_id),
INDEX idx_follower (follower_id),
INDEX idx_followed (followed_id),
CHECK (follower_id != followed_id)
);

CREATE TABLE Tags (
tag_id INT PRIMARY KEY AUTO_INCREMENT,
name VARCHAR(50) UNIQUE NOT NULL,
category ENUM('incident', 'event', 'help', 'general') NOT NULL,
color VARCHAR(7) DEFAULT '#808080',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE PostTags (
post_tag_id INT PRIMARY KEY AUTO_INCREMENT,
post_id INT NOT NULL,
tag_id INT NOT NULL,
FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE,
FOREIGN KEY (tag_id) REFERENCES Tags(tag_id) ON DELETE CASCADE,
UNIQUE KEY unique_post_tag (post_id, tag_id),
INDEX idx_post (post_id),
INDEX idx_tag (tag_id)
);

CREATE TABLE Badges (
badge_id INT PRIMARY KEY AUTO_INCREMENT,
name VARCHAR(100) NOT NULL,
description TEXT,
icon VARCHAR(10),
category ENUM('participation', 'contribution', 'leadership', 'special') DEFAULT 'participation',
points_value INT DEFAULT 0,
criteria_type VARCHAR(50),
criteria_value INT,
tier ENUM('bronze', 'silver', 'gold', 'platinum') DEFAULT 'bronze',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE UserBadges (
user_badge_id INT PRIMARY KEY AUTO_INCREMENT,
user_id INT NOT NULL,
badge_id INT NOT NULL,
earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
is_displayed BOOLEAN DEFAULT TRUE,
FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
FOREIGN KEY (badge_id) REFERENCES Badges(badge_id) ON DELETE CASCADE,
UNIQUE KEY unique_user_badge (user_id, badge_id),
INDEX idx_user (user_id)
);

CREATE TABLE TrustedContacts (
contact_id INT PRIMARY KEY AUTO_INCREMENT,
user_id INT NOT NULL,
trusted_user_id INT NOT NULL,
status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
FOREIGN KEY (trusted_user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
UNIQUE KEY unique_contact (user_id, trusted_user_id),
INDEX idx_user (user_id),
INDEX idx_trusted (trusted_user_id)
);

CREATE TABLE Notifications (
notification_id INT PRIMARY KEY AUTO_INCREMENT,
user_id INT NOT NULL,
type ENUM('alert', 'message', 'event', 'badge', 'verification', 'system', 'group_invite', 'group') NOT NULL,
title VARCHAR(255) NOT NULL,
content TEXT,
related_id INT,
related_type ENUM('post', 'event', 'message', 'user', 'group'),
is_read BOOLEAN DEFAULT FALSE,
priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
INDEX idx_user (user_id),
INDEX idx_read (is_read),
INDEX idx_created (created_at)
);

CREATE TABLE NotificationTokens (
token_id INT PRIMARY KEY AUTO_INCREMENT,
user_id INT NOT NULL,
token VARCHAR(500) NOT NULL,
platform ENUM('ios', 'android', 'web') NOT NULL,
device_id VARCHAR(255) NULL,
is_active BOOLEAN DEFAULT TRUE,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
last_used_at TIMESTAMP NULL,
UNIQUE KEY unique_token (token),
INDEX idx_user (user_id),
INDEX idx_active (is_active),
FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE TABLE MessageReactions (
reaction_id INT PRIMARY KEY AUTO_INCREMENT,
message_id INT NOT NULL,
message_type ENUM('dm', 'group') NOT NULL,
user_id INT NOT NULL,
emoji VARCHAR(10) NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
UNIQUE KEY unique_reaction (message_id, message_type, user_id, emoji),
INDEX idx_message (message_id, message_type),
INDEX idx_user (user_id),
FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE TABLE Likes (
like_id INT PRIMARY KEY AUTO_INCREMENT,
user_id INT NOT NULL,
post_id INT DEFAULT NULL,
event_id INT DEFAULT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
UNIQUE KEY unique_like_post (user_id, post_id),
UNIQUE KEY unique_like_event (user_id, event_id),
FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE,
FOREIGN KEY (event_id) REFERENCES Events(event_id) ON DELETE CASCADE
);

CREATE TABLE Comments (
comment_id INT PRIMARY KEY AUTO_INCREMENT,
post_id INT NOT NULL,
user_id INT NOT NULL,
content TEXT NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE,
FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
INDEX idx_post (post_id),
INDEX idx_user (user_id)
);

INSERT INTO Tags (name, category, color) VALUES
('Safety Alert', 'incident', '#FF0000'),
('Community Event', 'event', '#4CAF50'),
('Looking for Help', 'help', '#2196F3'),
('Lost Pet', 'general', '#FF9800'),
('Question', 'general', '#9C27B0'),
('Announcement', 'general', '#607D8B'),
('Suspicious Activity', 'incident', '#F44336'),
('Block Party', 'event', '#8BC34A'),
('Volunteering', 'help', '#00BCD4');

INSERT INTO Badges (name, description, icon, category, points_value, criteria_type, criteria_value, tier) VALUES
('First Post', 'Created your first post', '🎉', 'participation', 10, 'post_count', 1, 'bronze'),
('Chatty', 'Made 10 posts', '💬', 'participation', 25, 'post_count', 10, 'bronze'),
('Prolific', 'Made 50 posts', '📝', 'contribution', 100, 'post_count', 50, 'gold'),
('First Comment', 'Left your first comment', '💭', 'participation', 5, 'comment_count', 1, 'bronze'),
('Conversationalist', 'Made 25 comments', '🗨️', 'contribution', 50, 'comment_count', 25, 'silver'),
('Popular', 'Received 50 likes', '⭐', 'special', 75, 'likes_received', 50, 'silver'),
('Community Builder', 'Attended 5 events', '🏘️', 'contribution', 100, 'events_attended', 5, 'silver'),
('Event Organizer', 'Created your first event', '📅', 'leadership', 50, 'events_created', 1, 'bronze'),
('Safety Champion', 'Reported 10 incidents', '🛡️', 'leadership', 150, 'incidents_reported', 10, 'gold'),
('Trusted Neighbor', 'Added 10 trusted contacts', '🤝', 'participation', 30, 'trusted_contacts', 10, 'bronze');
