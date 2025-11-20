-- Add parent_task_id column to tasks table for revision tracking
-- This column links revision tasks to their parent task

ALTER TABLE tasks ADD COLUMN parent_task_id INTEGER;

-- Add foreign key constraint (SQLite will create the constraint on next restart)
-- In SQLite, we need to recreate the index manually
CREATE INDEX IF NOT EXISTS idx_parent_task_id ON tasks(parent_task_id);

-- Add revision_interval column if it doesn't exist
-- This stores which interval (1, 3, 7, 14 days) this revision represents
ALTER TABLE tasks ADD COLUMN revision_interval INTEGER;
