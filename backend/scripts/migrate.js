import { initializeDatabase } from '../config/database.js';
import { logger } from '../utils/logger.js';

async function runMigrations() {
  try {
    logger.info('Starting database migration...');
    
    // Initialize database (this will create all tables)
    await initializeDatabase();
    
    logger.info('Database migration completed successfully!');
    logger.info('All tables have been created and are ready to use.');
    
    process.exit(0);
  } catch (error) {
    logger.error('Database migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}

export { runMigrations }; 