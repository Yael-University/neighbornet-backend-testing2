-- Add invite metadata to GroupMemberships for group invites
ALTER TABLE GroupMemberships
ADD COLUMN invited_by INT NULL,
ADD COLUMN invite_created_at DATETIME NULL,
ADD COLUMN invite_id VARCHAR(128) NULL;

-- Index for quick lookup by invite_id
CREATE INDEX idx_group_invite_id ON GroupMemberships(invite_id);
