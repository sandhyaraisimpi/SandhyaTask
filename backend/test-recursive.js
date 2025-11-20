import { RecursiveTaskService } from './services/recursiveTaskService.js';
import { initializeDatabase } from './config/database.js';
import { logger } from './utils/logger.js';

async function testRecursiveFunctionality() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized for testing');

    // Test data
    const testTask = {
      user_id: 1,
      title: 'Test Recursive Task',
      description: 'This is a test recursive task',
      due_date: '2025-07-27',
      time: '09:00:00',
      priority: 'medium',
      tag: 'test',
      is_revision_task: false,
      spaced_pattern: '[1,3,7,14]',
      is_recursive: true,
      recursive_pattern: 'daily',
      recursive_interval: 1,
      recursive_end_date: '2025-08-27',
      status: 'completed'
    };

    logger.info('Testing recursive task generation...');
    
    // Test generating next occurrence
    const nextTask = await RecursiveTaskService.generateNextOccurrence(testTask);
    
    if (nextTask) {
      logger.info('✅ Next occurrence generated successfully:');
      logger.info(`   Title: ${nextTask.title}`);
      logger.info(`   Due Date: ${nextTask.due_date}`);
      logger.info(`   Pattern: ${nextTask.recursive_pattern}`);
    } else {
      logger.error('❌ Failed to generate next occurrence');
    }

    // Test processing completed recursive tasks
    logger.info('Testing recursive task processing...');
    const createdCount = await RecursiveTaskService.processCompletedRecursiveTasks();
    logger.info(`✅ Processed recursive tasks. Created ${createdCount} new occurrences.`);

    logger.info('🎉 Recursive functionality test completed successfully!');
  } catch (error) {
    logger.error('❌ Test failed:', error);
  }
}

// Run the test
testRecursiveFunctionality(); 