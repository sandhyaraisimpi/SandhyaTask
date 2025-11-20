-- Add local authentication fields to users table
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN is_local_auth BOOLEAN DEFAULT false;

-- Index for faster local auth queries
CREATE INDEX IF NOT EXISTS idx_users_email_local_auth ON users(email) WHERE is_local_auth = true;