#!/usr/bin/env node

import { seedDatabase } from './seed.js';

console.log('🌱 Starting SumiTask Database Seeding...');
console.log('=====================================');

try {
  await seedDatabase();
  console.log('\n🎉 Seeding completed successfully!');
  console.log('You can now test the application with sample data.');
} catch (error) {
  console.error('\n❌ Seeding failed:', error.message);
  process.exit(1);
} 