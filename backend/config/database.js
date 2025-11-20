import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;

// Database schema
const schema = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  google_id VARCHAR(100) UNIQUE,
  is_guest BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  task_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  time TIME,
  priority VARCHAR(20) DEFAULT 'medium',
  tag VARCHAR(50),
  is_revision_task BOOLEAN DEFAULT FALSE,
  spaced_pattern TEXT DEFAULT '[1,3,7,14]',
  is_recursive BOOLEAN DEFAULT FALSE,
  recursive_pattern VARCHAR(50),
  recursive_interval INTEGER DEFAULT 1,
  recursive_end_date DATE,
  recursive_end_after VARCHAR(20) DEFAULT 'never',
  recursive_end_after_count INTEGER DEFAULT 0,
  recursive_start_date DATE,
  recursive_time TIME,
  recursive_skip_weekends BOOLEAN DEFAULT FALSE,
  recursive_skip_holidays BOOLEAN DEFAULT FALSE,
  recursive_custom_pattern TEXT,
  recursive_original_task_id INTEGER,
  recursive_occurrence_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (recursive_original_task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
  UNIQUE(user_id, title, due_date)
);

-- Revisions table
CREATE TABLE IF NOT EXISTS revisions (
  revision_id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  revision_date DATE NOT NULL,
  revision_number INTEGER NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);

-- PDFs table
CREATE TABLE IF NOT EXISTS pdfs (
  pdf_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  original_title VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Blank pages table
CREATE TABLE IF NOT EXISTS blank_pages (
  page_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  pdf_id INTEGER,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  comparison_score DECIMAL(5,2),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (pdf_id) REFERENCES pdfs(pdf_id) ON DELETE SET NULL
);

-- Quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  quiz_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  page_id INTEGER,
  quiz_data TEXT NOT NULL, -- JSON string
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES blank_pages(page_id) ON DELETE SET NULL
);

-- WhatsApp logs table
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  message TEXT NOT NULL,
  command_type VARCHAR(50),
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  theme VARCHAR(10) DEFAULT 'light',
  reminder_time TIME DEFAULT '09:00:00',
  whatsapp_enabled BOOLEAN DEFAULT TRUE,
  default_intervals TEXT DEFAULT '[1,3,7,14]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  feedback_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  message TEXT NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action_type VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  metadata TEXT, -- JSON string
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_revisions_task_id ON revisions(task_id);
CREATE INDEX IF NOT EXISTS idx_revisions_date ON revisions(revision_date);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_user_id ON whatsapp_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
`;

// Initialize database
export const initializeDatabase = async () => {
  try {
    const dbPath = process.env.DB_PATH || './database/sumitask.db';
    
    // Ensure database directory exists
    const dbDir = path.dirname(dbPath);
    await import('fs').then(fs => {
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
    });

    // Open database connection
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Enable foreign keys
    await db.exec('PRAGMA foreign_keys = ON');
    
    // Create tables
    await db.exec(schema);
    
    logger.info('Database initialized successfully');
    
    return db;
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
};

// Get database instance
export const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
};

// Close database connection
export const closeDatabase = async () => {
  if (db) {
    await db.close();
    logger.info('Database connection closed');
  }
};

// Database helper functions
export const dbHelpers = {
  // Run a query with parameters
  async run(sql, params = []) {
    const database = getDatabase();
    return await database.run(sql, params);
  },

  // Get a single row
  async get(sql, params = []) {
    const database = getDatabase();
    return await database.get(sql, params);
  },

  // Get multiple rows
  async all(sql, params = []) {
    const database = getDatabase();
    return await database.all(sql, params);
  },

  // Begin transaction
  async beginTransaction() {
    const database = getDatabase();
    await database.run('BEGIN TRANSACTION');
  },

  // Commit transaction
  async commitTransaction() {
    const database = getDatabase();
    await database.run('COMMIT');
  },

  // Rollback transaction
  async rollbackTransaction() {
    const database = getDatabase();
    await database.run('ROLLBACK');
  }
}; 