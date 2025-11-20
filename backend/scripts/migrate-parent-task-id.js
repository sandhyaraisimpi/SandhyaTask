import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine database path
const isDev = process.env.NODE_ENV !== 'production';
let dbPath;

if (isDev) {
  dbPath = path.join(__dirname, '..', 'database', 'sumitask.db');
} else {
  const appDataPath = process.env.APPDATA || 
    (process.platform === 'darwin' 
      ? path.join(process.env.HOME, 'Library', 'Application Support')
      : path.join(process.env.HOME, '.local', 'share'));
  const dbDir = path.join(appDataPath, 'SumiTask');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  dbPath = path.join(dbDir, 'sumitask.db');
}

console.log('Migrating database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open database:', err);
    process.exit(1);
  }
});

// Promisify db methods
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

(async () => {
  try {
    // Check if parent_task_id column exists
    const tableInfo = await all('PRAGMA table_info(tasks)');
    const hasParentTaskId = tableInfo.some(col => col.name === 'parent_task_id');
    const hasRevisionInterval = tableInfo.some(col => col.name === 'revision_interval');

    if (!hasParentTaskId) {
      console.log('Adding parent_task_id column...');
      await run('ALTER TABLE tasks ADD COLUMN parent_task_id INTEGER');
      await run('CREATE INDEX IF NOT EXISTS idx_parent_task_id ON tasks(parent_task_id)');
      console.log('✓ Added parent_task_id column');
    } else {
      console.log('✓ parent_task_id column already exists');
    }

    if (!hasRevisionInterval) {
      console.log('Adding revision_interval column...');
      await run('ALTER TABLE tasks ADD COLUMN revision_interval INTEGER');
      console.log('✓ Added revision_interval column');
    } else {
      console.log('✓ revision_interval column already exists');
    }

    console.log('✓ Migration completed successfully');
    db.close();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    db.close();
    process.exit(1);
  }
})();
