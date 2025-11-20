import { initializeDatabase } from './config/database.js';
import { logger } from './utils/logger.js';

console.log('🔍 Starting backend debug script...');

try {
  console.log('📦 Checking database initialization...');
  await initializeDatabase();
  console.log('✅ Database initialized successfully');
  
  console.log('🚀 Attempting to start server...');
  const { default: app } = await import('./server.js');
  console.log('✅ Server import successful');
  
} catch (error) {
  console.error('❌ Error during startup:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
} 