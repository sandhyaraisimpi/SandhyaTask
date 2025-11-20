-- Add index for user_id to speed up user queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);

-- Add index for due_date to speed up calendar queries
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- Add composite index for user_id and due_date for optimal calendar queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_due_date ON tasks(user_id, due_date);