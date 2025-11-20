import { dbHelpers } from '../config/database.js';
import { logger } from '../utils/logger.js';
import moment from 'moment';

async function seedDatabase() {
  try {
    logger.info('Starting database seeding...');
    
    // Create a sample user
    const userResult = await dbHelpers.run(
      'INSERT INTO users (name, email, google_id, is_guest) VALUES (?, ?, ?, ?)',
      ['Sample User', 'sample@example.com', 'sample_google_id', false]
    );
    
    const userId = userResult.lastID;
    logger.info(`Created sample user with ID: ${userId}`);
    
    // Create comprehensive sample tasks covering all functionality
    const sampleTasks = [
      // Regular Tasks
      {
        title: '📝 Submit Math Assignment',
        description: 'Complete calculus problems from Chapter 3 - Derivatives and Applications',
        due_date: moment().add(1, 'day').format('YYYY-MM-DD'),
        time: '14:00',
        priority: 'HIGH',
        tag: 'Study',
        is_revision_task: false,
        is_recursive: false
      },
      {
        title: '📚 Read Research Paper',
        description: 'Read and summarize the latest AI research paper for Computer Science class',
        due_date: moment().add(2, 'days').format('YYYY-MM-DD'),
        time: '16:00',
        priority: 'MEDIUM',
        tag: 'Research',
        is_revision_task: false,
        is_recursive: false
      },
      {
        title: '🏃‍♂️ Gym Workout',
        description: 'Complete strength training routine - chest and triceps',
        due_date: moment().format('YYYY-MM-DD'),
        time: '18:00',
        priority: 'LOW',
        tag: 'Health',
        is_revision_task: false,
        is_recursive: false
      },
      
      // Revision Tasks (Spaced Repetition)
      {
        title: '🔁 Day 3: Revise Biology Notes',
        description: 'Review cell biology concepts - mitochondria, chloroplasts, and cellular respiration',
        due_date: moment().format('YYYY-MM-DD'),
        time: '10:00',
        priority: 'MEDIUM',
        tag: 'Revision',
        is_revision_task: true,
        is_recursive: false,
        spaced_pattern: '[1,3,7,14]'
      },
      {
        title: '🔁 Day 7: Chemistry Formulas',
        description: 'Memorize and practice chemical equations and molecular structures',
        due_date: moment().add(1, 'day').format('YYYY-MM-DD'),
        time: '15:00',
        priority: 'HIGH',
        tag: 'Revision',
        is_revision_task: true,
        is_recursive: false,
        spaced_pattern: '[1,3,7,14]'
      },
      {
        title: '🔁 Day 1: History Timeline',
        description: 'Learn key events from World War II timeline and their significance',
        due_date: moment().add(3, 'days').format('YYYY-MM-DD'),
        time: '11:00',
        priority: 'MEDIUM',
        tag: 'Revision',
        is_revision_task: true,
        is_recursive: false,
        spaced_pattern: '[1,3,7,14]'
      },
      
      // Blank Page Revision Tasks
      {
        title: '📄 Physics Laws - Blank Page Revision',
        description: 'Recall and write down Newton\'s laws of motion, gravitational force, and energy conservation principles',
        due_date: moment().add(1, 'day').format('YYYY-MM-DD'),
        time: '13:00',
        priority: 'HIGH',
        tag: 'Blank Page',
        is_revision_task: true,
        is_recursive: false,
        is_blank_page_revision: true,
        original_file_name: 'physics_notes.pdf',
        spaced_pattern: '[1,3,7,14]'
      },
      {
        title: '📄 Literature Analysis - Blank Page Revision',
        description: 'Write analysis of Shakespeare\'s Hamlet themes, character development, and plot structure',
        due_date: moment().add(2, 'days').format('YYYY-MM-DD'),
        time: '14:00',
        priority: 'MEDIUM',
        tag: 'Blank Page',
        is_revision_task: true,
        is_recursive: false,
        is_blank_page_revision: true,
        original_file_name: 'hamlet_study_guide.pdf',
        spaced_pattern: '[1,3,7,14]'
      },
      
      // Recursive Tasks (Daily)
      {
        title: '💧 Drink Water',
        description: 'Stay hydrated - drink 8 glasses of water throughout the day',
        due_date: moment().format('YYYY-MM-DD'),
        time: '09:00',
        priority: 'LOW',
        tag: 'Health',
        is_revision_task: false,
        is_recursive: true,
        recursive_pattern: 'daily',
        recursive_interval: 1,
        recursive_start_date: moment().format('YYYY-MM-DD'),
        recursive_end_after_count: 30
      },
      
      // Recursive Tasks (Weekly)
      {
        title: '🧹 Clean Room',
        description: 'Weekly room cleaning - organize desk, vacuum, change bedsheets',
        due_date: moment().add(7, 'days').format('YYYY-MM-DD'),
        time: '10:00',
        priority: 'MEDIUM',
        tag: 'Chores',
        is_revision_task: false,
        is_recursive: true,
        recursive_pattern: 'weekly',
        recursive_interval: 1,
        recursive_start_date: moment().add(7, 'days').format('YYYY-MM-DD'),
        recursive_end_after_count: 12
      },
      
      // Recursive Tasks (Weekdays)
      {
        title: '📖 Morning Reading',
        description: 'Read 30 minutes of non-fiction book before starting the day',
        due_date: moment().format('YYYY-MM-DD'),
        time: '07:00',
        priority: 'MEDIUM',
        tag: 'Self-Improvement',
        is_revision_task: false,
        is_recursive: true,
        recursive_pattern: 'weekdays',
        recursive_interval: 1,
        recursive_start_date: moment().format('YYYY-MM-DD'),
        recursive_end_after_count: 50
      },
      
      // Recursive Tasks (Monthly)
      {
        title: '💰 Budget Review',
        description: 'Review monthly expenses, update budget spreadsheet, plan for next month',
        due_date: moment().add(30, 'days').format('YYYY-MM-DD'),
        time: '19:00',
        priority: 'HIGH',
        tag: 'Finance',
        is_revision_task: false,
        is_recursive: true,
        recursive_pattern: 'monthly',
        recursive_interval: 1,
        recursive_start_date: moment().add(30, 'days').format('YYYY-MM-DD'),
        recursive_end_after_count: 12
      },
      
      // Past Tasks (for testing past date functionality)
      {
        title: '📝 Completed Essay',
        description: 'Submit final draft of English literature essay (COMPLETED)',
        due_date: moment().subtract(2, 'days').format('YYYY-MM-DD'),
        time: '17:00',
        priority: 'HIGH',
        tag: 'Assignment',
        is_revision_task: false,
        is_recursive: false,
        status: 'completed'
      },
      {
        title: '🔁 Day 14: Math Review',
        description: 'Final review of algebra concepts before exam (COMPLETED)',
        due_date: moment().subtract(1, 'day').format('YYYY-MM-DD'),
        time: '16:00',
        priority: 'HIGH',
        tag: 'Revision',
        is_revision_task: true,
        is_recursive: false,
        status: 'completed',
        spaced_pattern: '[1,3,7,14]'
      }
    ];
    
    for (const task of sampleTasks) {
      const taskResult = await dbHelpers.run(
        `INSERT INTO tasks (
          user_id, title, description, due_date, time, priority, tag, 
          is_revision_task, is_recursive, recursive_pattern, recursive_interval,
          recursive_start_date, recursive_end_after_count, is_blank_page_revision,
          original_file_name, spaced_pattern, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          task.title,
          task.description,
          task.due_date,
          task.time,
          task.priority,
          task.tag,
          task.is_revision_task,
          task.is_recursive,
          task.recursive_pattern || null,
          task.recursive_interval || null,
          task.recursive_start_date || null,
          task.recursive_end_after_count || null,
          task.is_blank_page_revision || false,
          task.original_file_name || null,
          task.spaced_pattern || null,
          task.status || 'pending'
        ]
      );
      
      // Create revisions for revision tasks
      if (task.is_revision_task && task.spaced_pattern) {
        const pattern = JSON.parse(task.spaced_pattern);
        for (let i = 0; i < pattern.length; i++) {
          const revisionDate = moment(task.due_date).add(pattern[i], 'days').format('YYYY-MM-DD');
          await dbHelpers.run(
            'INSERT INTO revisions (task_id, user_id, revision_date, revision_number, is_blank_page_revision) VALUES (?, ?, ?, ?, ?)',
            [taskResult.lastID, userId, revisionDate, i + 1, task.is_blank_page_revision || false]
          );
        }
      }
    }
    
    logger.info('Created comprehensive sample tasks covering all functionality');
    
    // Create sample settings
    await dbHelpers.run(
      `INSERT INTO settings (
        user_id, theme, reminder_time, whatsapp_enabled, default_intervals
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        'light',
        '09:00:00',
        true,
        '[1,3,7,14]'
      ]
    );
    
    logger.info('Created sample user settings');
    
    // Create sample audit logs
    const auditLogs = [
      {
        action_type: 'user_created',
        entity: 'user',
        metadata: { user_id: userId, name: 'Sample User' }
      },
      {
        action_type: 'task_created',
        entity: 'task',
        metadata: { task_title: '📝 Submit Math Assignment', task_type: 'regular' }
      },
      {
        action_type: 'task_created',
        entity: 'task',
        metadata: { task_title: '🔁 Day 3: Revise Biology Notes', task_type: 'revision' }
      },
      {
        action_type: 'task_created',
        entity: 'task',
        metadata: { task_title: '📄 Physics Laws - Blank Page Revision', task_type: 'blank_page_revision' }
      },
      {
        action_type: 'task_created',
        entity: 'task',
        metadata: { task_title: '💧 Drink Water', task_type: 'recursive_daily' }
      },
      {
        action_type: 'settings_updated',
        entity: 'settings',
        metadata: { theme: 'light', whatsapp_enabled: true }
      }
    ];
    
    for (const log of auditLogs) {
      await dbHelpers.run(
        'INSERT INTO audit_logs (user_id, action_type, entity, metadata) VALUES (?, ?, ?, ?)',
        [userId, log.action_type, log.entity, JSON.stringify(log.metadata)]
      );
    }
    
    logger.info('Created sample audit logs');
    
    logger.info('✅ Database seeding completed successfully!');
    logger.info(`📊 Sample user ID: ${userId}`);
    logger.info('🎯 Sample tasks created:');
    logger.info('   • 3 Regular tasks (different priorities and categories)');
    logger.info('   • 3 Revision tasks with spaced repetition');
    logger.info('   • 2 Blank page revision tasks');
    logger.info('   • 4 Recursive tasks (daily, weekly, weekdays, monthly)');
    logger.info('   • 2 Completed past tasks');
    logger.info('');
    logger.info('🧪 You can now test all functionality:');
    logger.info('   • Calendar view with different task types');
    logger.info('   • Task completion and status updates');
    logger.info('   • Revision scheduling and management');
    logger.info('   • Recursive task generation');
    logger.info('   • Blank page revision workflow');
    logger.info('   • Past date task viewing');
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}

export { seedDatabase }; 