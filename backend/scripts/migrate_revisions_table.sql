-- Migration script to add file_metadata field to revisions table
-- This enables storing AI analysis results and file information

-- Add file_metadata column to revisions table
ALTER TABLE revisions ADD COLUMN file_metadata TEXT;

-- Add index for better query performance
CREATE INDEX idx_revisions_file_metadata ON revisions(file_metadata);

-- Add comment to document the purpose
COMMENT ON COLUMN revisions.file_metadata IS 'JSON metadata for uploaded files including AI analysis results, file info, and comparison stats';

-- Update existing revisions to have empty metadata
UPDATE revisions SET file_metadata = '{}' WHERE file_metadata IS NULL;

-- Make file_metadata NOT NULL with default empty object
ALTER TABLE revisions ALTER COLUMN file_metadata SET NOT NULL;
ALTER TABLE revisions ALTER COLUMN file_metadata SET DEFAULT '{}';

-- Add completed_at column if it doesn't exist
ALTER TABLE revisions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- Add user_id column if it doesn't exist (for better data isolation)
ALTER TABLE revisions ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(user_id) ON DELETE CASCADE;

-- Create index for user_id for better performance
CREATE INDEX IF NOT EXISTS idx_revisions_user_id ON revisions(user_id);

-- Add audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  action_type VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  metadata TEXT, -- JSON metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Audit trail for user actions and system events';
COMMENT ON COLUMN audit_logs.metadata IS 'JSON metadata containing action details'; 