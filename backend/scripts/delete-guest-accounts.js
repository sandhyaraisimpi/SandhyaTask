import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deleteGuestAccounts() {
  const dbPath = path.join(__dirname, '../database/sumitask.db');
  
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  try {
    // First, get count of guest accounts
    const guestCount = await db.get(
      `SELECT COUNT(*) as count FROM users WHERE is_guest = 1`
    );
    
    console.log(`\n🗑️  Found ${guestCount.count} guest accounts to delete...\n`);

    if (guestCount.count === 0) {
      console.log('✅ No guest accounts found. Nothing to delete.');
      return;
    }

    // Get list of guest users before deletion
    const guestUsers = await db.all(
      `SELECT user_id, name, email FROM users WHERE is_guest = 1`
    );

    console.log('📋 Guest accounts to be deleted:');
    guestUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.email}) - ID: ${user.user_id}`);
    });

    // Delete tasks associated with guest accounts
    const taskResult = await db.run(
      `DELETE FROM tasks WHERE user_id IN (SELECT user_id FROM users WHERE is_guest = 1)`
    );
    console.log(`\n🗑️  Deleted ${taskResult.changes} tasks associated with guest accounts`);

    // Delete revisions associated with guest accounts' tasks (revisions are already deleted as tasks were deleted)
    // No need for separate revision deletion since tasks are gone

    // Delete guest accounts
    const userResult = await db.run(
      `DELETE FROM users WHERE is_guest = 1`
    );
    console.log(`🗑️  Deleted ${userResult.changes} guest accounts`);

    // Verify deletion
    const remainingGuests = await db.get(
      `SELECT COUNT(*) as count FROM users WHERE is_guest = 1`
    );
    
    const totalUsers = await db.get(`SELECT COUNT(*) as count FROM users`);

    console.log(`\n✅ Done!`);
    console.log(`📊 Remaining users: ${totalUsers.count}`);
    console.log(`   └─ Guest accounts: ${remainingGuests.count}`);

  } catch (error) {
    console.error('❌ Error deleting guest accounts:', error);
  } finally {
    await db.close();
  }
}

deleteGuestAccounts();
