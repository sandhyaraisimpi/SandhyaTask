-- Add blank page revision support columns to tasks table
-- Run this migration to add support for blank page revisions

-- Add is_blank_page_revision column
ALTER TABLE tasks ADD COLUMN is_blank_page_revision INTEGER DEFAULT 0;

-- Add original_file_name column to store the original study material filename
ALTER TABLE tasks ADD COLUMN original_file_name TEXT;

-- Create index for faster queries on blank page revisions
CREATE INDEX IF NOT EXISTS idx_tasks_blank_page ON tasks(is_blank_page_revision, due_date);
