import { dbHelpers, initializeDatabase } from './config/database.js';
import { RecursiveTaskService } from './services/recursiveTaskService.js';
import { logger } from './utils/logger.js';
import moment from 'moment';

/**
 * Comprehensive test for robust recursive task functionality
 */

async function testRobustRecursiveFeatures() {
  try {
    logger.info('🧪 Starting comprehensive recursive task feature tests...');

    // Initialize database
    await initializeDatabase();
    logger.info('✅ Database initialized for testing');

    // Clean up test data
    await dbHelpers.run('DELETE FROM tasks WHERE title LIKE "Test Recursive%"');
    logger.info('✅ Database cleaned for testing');

    // Test 1: Basic patterns with intervals
    logger.info('\n📅 Test 1: Basic patterns with intervals');
    await testBasicPatterns();

    // Test 2: Weekday patterns
    logger.info('\n📅 Test 2: Weekday patterns');
    await testWeekdayPatterns();

    // Test 3: Advanced patterns
    logger.info('\n📅 Test 3: Advanced patterns');
    await testAdvancedPatterns();

    // Test 4: End conditions
    logger.info('\n📅 Test 4: End conditions');
    await testEndConditions();

    // Test 5: Advanced options
    logger.info('\n📅 Test 5: Advanced options');
    await testAdvancedOptions();

    // Test 6: Custom patterns
    logger.info('\n📅 Test 6: Custom patterns');
    await testCustomPatterns();

    logger.info('\n🎉 All robust recursive feature tests completed successfully!');
  } catch (error) {
    logger.error('❌ Test failed:', error);
  }
}

async function testBasicPatterns() {
  const patterns = [
    { pattern: 'daily', interval: 2, description: 'Every 2 days' },
    { pattern: 'weekly', interval: 3, description: 'Every 3 weeks' },
    { pattern: 'monthly', interval: 2, description: 'Every 2 months' },
    { pattern: 'yearly', interval: 1, description: 'Every year' }
  ];

  for (const { pattern, interval, description } of patterns) {
    const task = {
      user_id: 1,
      title: `Test Recursive ${description}`,
      description: `Testing ${pattern} pattern with interval ${interval}`,
      due_date: moment().format('YYYY-MM-DD'),
      time: '09:00',
      priority: 'medium',
      is_recursive: true,
      recursive_pattern: pattern,
      recursive_interval: interval,
      recursive_end_after: 'count',
      recursive_end_after_count: 3
    };

    const nextTask = await RecursiveTaskService.generateNextOccurrence(task);
    if (nextTask) {
      logger.info(`✅ ${description}: Next occurrence on ${nextTask.due_date}`);
    } else {
      logger.error(`❌ ${description}: Failed to generate next occurrence`);
    }
  }
}

async function testWeekdayPatterns() {
  const patterns = [
    { pattern: 'monday', description: 'Every Monday' },
    { pattern: 'tuesday', description: 'Every Tuesday' },
    { pattern: 'wednesday', description: 'Every Wednesday' },
    { pattern: 'thursday', description: 'Every Thursday' },
    { pattern: 'friday', description: 'Every Friday' },
    { pattern: 'saturday', description: 'Every Saturday' },
    { pattern: 'sunday', description: 'Every Sunday' },
    { pattern: 'weekdays', description: 'Every Weekday' },
    { pattern: 'weekends', description: 'Every Weekend' }
  ];

  for (const { pattern, description } of patterns) {
    const task = {
      user_id: 1,
      title: `Test Recursive ${description}`,
      description: `Testing ${pattern} pattern`,
      due_date: moment().format('YYYY-MM-DD'),
      time: '09:00',
      priority: 'medium',
      is_recursive: true,
      recursive_pattern: pattern,
      recursive_end_after: 'count',
      recursive_end_after_count: 2
    };

    const nextTask = await RecursiveTaskService.generateNextOccurrence(task);
    if (nextTask) {
      logger.info(`✅ ${description}: Next occurrence on ${nextTask.due_date}`);
    } else {
      logger.error(`❌ ${description}: Failed to generate next occurrence`);
    }
  }
}

async function testAdvancedPatterns() {
  const patterns = [
    { pattern: 'biweekly', description: 'Every 2 weeks' },
    { pattern: 'quarterly', description: 'Every 3 months' },
    { pattern: 'semiannual', description: 'Every 6 months' }
  ];

  for (const { pattern, description } of patterns) {
    const task = {
      user_id: 1,
      title: `Test Recursive ${description}`,
      description: `Testing ${pattern} pattern`,
      due_date: moment().format('YYYY-MM-DD'),
      time: '09:00',
      priority: 'medium',
      is_recursive: true,
      recursive_pattern: pattern,
      recursive_end_after: 'count',
      recursive_end_after_count: 2
    };

    const nextTask = await RecursiveTaskService.generateNextOccurrence(task);
    if (nextTask) {
      logger.info(`✅ ${description}: Next occurrence on ${nextTask.due_date}`);
    } else {
      logger.error(`❌ ${description}: Failed to generate next occurrence`);
    }
  }
}

async function testEndConditions() {
  const endConditions = [
    { 
      type: 'never', 
      description: 'Never end',
      task: {
        user_id: 1,
        title: 'Test Recursive Never End',
        description: 'Testing never end condition',
        due_date: moment().format('YYYY-MM-DD'),
        time: '09:00',
        priority: 'medium',
        is_recursive: true,
        recursive_pattern: 'daily',
        recursive_end_after: 'never'
      }
    },
    { 
      type: 'date', 
      description: 'End on date',
      task: {
        user_id: 1,
        title: 'Test Recursive End Date',
        description: 'Testing end date condition',
        due_date: moment().format('YYYY-MM-DD'),
        time: '09:00',
        priority: 'medium',
        is_recursive: true,
        recursive_pattern: 'daily',
        recursive_end_after: 'date',
        recursive_end_date: moment().add(7, 'days').format('YYYY-MM-DD')
      }
    },
    { 
      type: 'count', 
      description: 'End after count',
      task: {
        user_id: 1,
        title: 'Test Recursive End Count',
        description: 'Testing end count condition',
        due_date: moment().format('YYYY-MM-DD'),
        time: '09:00',
        priority: 'medium',
        is_recursive: true,
        recursive_pattern: 'daily',
        recursive_end_after: 'count',
        recursive_end_after_count: 5
      }
    }
  ];

  for (const { type, description, task } of endConditions) {
    const nextTask = await RecursiveTaskService.generateNextOccurrence(task);
    if (nextTask) {
      logger.info(`✅ ${description}: Next occurrence on ${nextTask.due_date}`);
    } else {
      logger.error(`❌ ${description}: Failed to generate next occurrence`);
    }
  }
}

async function testAdvancedOptions() {
  const advancedOptions = [
    {
      description: 'Skip weekends',
      task: {
        user_id: 1,
        title: 'Test Recursive Skip Weekends',
        description: 'Testing skip weekends option',
        due_date: moment().format('YYYY-MM-DD'),
        time: '09:00',
        priority: 'medium',
        is_recursive: true,
        recursive_pattern: 'daily',
        recursive_skip_weekends: true,
        recursive_end_after: 'count',
        recursive_end_after_count: 3
      }
    },
    {
      description: 'Skip holidays',
      task: {
        user_id: 1,
        title: 'Test Recursive Skip Holidays',
        description: 'Testing skip holidays option',
        due_date: moment().format('YYYY-MM-DD'),
        time: '09:00',
        priority: 'medium',
        is_recursive: true,
        recursive_pattern: 'daily',
        recursive_skip_holidays: true,
        recursive_end_after: 'count',
        recursive_end_after_count: 3
      }
    }
  ];

  for (const { description, task } of advancedOptions) {
    const nextTask = await RecursiveTaskService.generateNextOccurrence(task);
    if (nextTask) {
      logger.info(`✅ ${description}: Next occurrence on ${nextTask.due_date}`);
    } else {
      logger.error(`❌ ${description}: Failed to generate next occurrence`);
    }
  }
}

async function testCustomPatterns() {
  const customPatterns = [
    { pattern: '0 9 * * 1', description: 'Every Monday at 9 AM' },
    { pattern: '0 18 * * 5', description: 'Every Friday at 6 PM' },
    { pattern: '30 14 * * 0', description: 'Every Sunday at 2:30 PM' }
  ];

  for (const { pattern, description } of customPatterns) {
    const task = {
      user_id: 1,
      title: `Test Recursive ${description}`,
      description: `Testing custom pattern: ${pattern}`,
      due_date: moment().format('YYYY-MM-DD'),
      time: '09:00',
      priority: 'medium',
      is_recursive: true,
      recursive_pattern: 'custom',
      recursive_custom_pattern: pattern,
      recursive_end_after: 'count',
      recursive_end_after_count: 2
    };

    const nextTask = await RecursiveTaskService.generateNextOccurrence(task);
    if (nextTask) {
      logger.info(`✅ ${description}: Next occurrence on ${nextTask.due_date}`);
    } else {
      logger.error(`❌ ${description}: Failed to generate next occurrence`);
    }
  }
}

// Run the tests
testRobustRecursiveFeatures().then(() => {
  process.exit(0);
}).catch((error) => {
  logger.error('Test suite failed:', error);
  process.exit(1);
}); 