import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../database/sumitask.db');

// Open database
const db = await open({
  filename: dbPath,
  driver: sqlite3.Database
});

console.log('\n📊 User Statistics\n');

// Total users
const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
console.log(`Total Users: ${totalUsers.count}`);

// Guest vs Google users
const googleUsers = await db.get('SELECT COUNT(*) as count FROM users WHERE google_id IS NOT NULL');
const guestUsers = await db.get('SELECT COUNT(*) as count FROM users WHERE is_guest = 1');

console.log(`├─ Google Users: ${googleUsers.count}`);
console.log(`└─ Guest Users: ${guestUsers.count}`);

// List all users
console.log('\n👥 All Users:\n');
const users = await db.all(`
  SELECT 
    user_id, 
    name, 
    email, 
    is_guest,
    created_at
  FROM users 
  ORDER BY created_at DESC
`);

users.forEach((user, index) => {
  const type = user.is_guest ? '👤 Guest' : '🔐 Google';
  console.log(`${index + 1}. ${type} - ${user.name} (${user.email})`);
  console.log(`   ID: ${user.user_id} | Created: ${user.created_at || 'N/A'}`);
});

// Task statistics per user
console.log('\n📝 Tasks per User:\n');
const taskStats = await db.all(`
  SELECT 
    u.user_id,
    u.name,
    COUNT(t.task_id) as task_count
  FROM users u
  LEFT JOIN tasks t ON u.user_id = t.user_id
  GROUP BY u.user_id
  ORDER BY task_count DESC
`);

taskStats.forEach((stat) => {
  console.log(`├─ ${stat.name}: ${stat.task_count} tasks`);
});

await db.close();
console.log('\n✅ Done!\n');
