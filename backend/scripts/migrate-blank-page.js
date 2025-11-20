import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', 'database', 'sumitask.db');
const migrationPath = join(__dirname, 'add_blank_page_columns.sql');

console.log('📦 Running blank page columns migration...');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
});

// Execute migrations directly
const migrations = [
  'ALTER TABLE tasks ADD COLUMN is_blank_page_revision INTEGER DEFAULT 0',
  'ALTER TABLE tasks ADD COLUMN original_file_name TEXT',
  'CREATE INDEX IF NOT EXISTS idx_tasks_blank_page ON tasks(is_blank_page_revision, due_date)'
];

console.log(`Executing ${migrations.length} migrations...`);

let completed = 0;
migrations.forEach((sql, index) => {
  db.run(sql, (err) => {
    if (err) {
      // Ignore "duplicate column" errors as columns may already exist
      if (err.message.includes('duplicate column')) {
        console.log(`⚠️  Statement ${index + 1}: Column already exists, skipping...`);
      } else {
        console.error(`❌ Error executing statement ${index + 1}:`, err.message);
      }
    } else {
      console.log(`✅ Statement ${index + 1} executed successfully`);
    }
    
    completed++;
    if (completed === migrations.length) {
      console.log('✅ Migration completed!');
      db.close();
    }
  });
});
