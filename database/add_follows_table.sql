-- Create follows table for user follow relationships
CREATE TABLE IF NOT EXISTS Follows (
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
