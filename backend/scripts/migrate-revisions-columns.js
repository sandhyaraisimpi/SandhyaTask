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

console.log('Migrating revisions table at:', dbPath);

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
    // Check if columns exist in revisions table
    const tableInfo = await all('PRAGMA table_info(revisions)');
    const hasDueDate = tableInfo.some(col => col.name === 'due_date');
    const hasIntervalDays = tableInfo.some(col => col.name === 'interval_days');
    const hasStatus = tableInfo.some(col => col.name === 'status');

    if (!hasDueDate) {
      console.log('Adding due_date column to revisions...');
      await run('ALTER TABLE revisions ADD COLUMN due_date DATE');
      console.log('✓ Added due_date column');
    } else {
      console.log('✓ due_date column already exists');
    }

    if (!hasIntervalDays) {
      console.log('Adding interval_days column to revisions...');
      await run('ALTER TABLE revisions ADD COLUMN interval_days INTEGER');
      console.log('✓ Added interval_days column');
    } else {
      console.log('✓ interval_days column already exists');
    }

    if (!hasStatus) {
      console.log('Adding status column to revisions...');
      await run('ALTER TABLE revisions ADD COLUMN status VARCHAR(20) DEFAULT "pending"');
      console.log('✓ Added status column');
    } else {
      console.log('✓ status column already exists');
    }

    console.log('✓ Revisions table migration completed successfully');
    db.close();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    db.close();
    process.exit(1);
  }
})();
