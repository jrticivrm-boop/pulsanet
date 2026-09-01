-- TacticalPtx v1.1: media metadata + file message type
ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'file';

ALTER TABLE messages
 ADD COLUMN IF NOT EXISTS media_mime VARCHAR(120),
 ADD COLUMN IF NOT EXISTS media_name VARCHAR(255),
 ADD COLUMN IF NOT EXISTS media_size INT;
