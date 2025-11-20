// Node.js script to remove recursive_custom_pattern column from tasks table in SQLite
const sqlite3 = require('sqlite3').verbose();
const dbPath = __dirname + '/database.sqlite';

const migration = `
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;
CREATE TABLE tasks_new AS SELECT 
  user_id, title, description, due_date, time, priority, tag, 
  is_revision_task, is_blank_page_revision, original_file_name, spaced_pattern, is_recursive, recursive_pattern, 
  recursive_interval, recursive_end_date, recursive_end_after, 
  recursive_end_after_count, recursive_start_date, recursive_time,
  recursive_skip_weekends, recursive_skip_holidays, status, task_id, recursive_original_task_id, recursive_occurrence_count, created_at, updated_at
FROM tasks;
DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;
COMMIT;
PRAGMA foreign_keys=on;
`;

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) throw err;
});

db.exec(migration, (err) => {
  if (err) {
    console.error('Migration failed:', err.message);
  } else {
    console.log('Column recursive_custom_pattern removed successfully.');
  }
  db.close();
});
