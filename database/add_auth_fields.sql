-- Add email verification fields
ALTER TABLE Users 
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN verification_token VARCHAR(255),
ADD COLUMN verification_token_expires DATETIME,
ADD COLUMN reset_password_token VARCHAR(255),
ADD COLUMN reset_password_expires DATETIME;

-- Add indexes for faster lookups
CREATE INDEX idx_verification_token ON Users(verification_token);
CREATE INDEX idx_reset_token ON Users(reset_password_token);
