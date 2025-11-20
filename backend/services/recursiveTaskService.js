import moment from 'moment';
import { dbHelpers } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Recursive Task Service
 * Handles the generation and management of recursive tasks
 */

export class RecursiveTaskService {
  /**
   * Generate the next occurrence of a recursive task
   * @param {Object} task - The original task object
   * @returns {Object|null} - The next task occurrence or null if end date reached
   */
  static async generateNextOccurrence(task) {
    try {
      if (!task.is_recursive || !task.recursive_pattern) {
        return null;
      }

      const currentDate = moment(task.due_date);
      let nextDate = moment(currentDate);

      // Calculate next date based on pattern
      switch (task.recursive_pattern) {
        case 'daily':
          nextDate.add(task.recursive_interval || 1, 'day');
          break;
        case 'weekly':
          nextDate.add(task.recursive_interval || 1, 'week');
          break;
        case 'monthly':
          nextDate.add(task.recursive_interval || 1, 'month');
          break;
        case 'yearly':
          nextDate.add(task.recursive_interval || 1, 'year');
          break;
        case 'biweekly':
          nextDate.add(2, 'weeks');
          break;
        case 'quarterly':
          nextDate.add(3, 'months');
          break;
        case 'semiannual':
          nextDate.add(6, 'months');
          break;
        case 'monday':
          nextDate.add(1, 'week').startOf('week').add(0, 'days');
          break;
        case 'tuesday':
          nextDate.add(1, 'week').startOf('week').add(1, 'days');
          break;
        case 'wednesday':
          nextDate.add(1, 'week').startOf('week').add(2, 'days');
          break;
        case 'thursday':
          nextDate.add(1, 'week').startOf('week').add(3, 'days');
          break;
        case 'friday':
          nextDate.add(1, 'week').startOf('week').add(4, 'days');
          break;
        case 'saturday':
          nextDate.add(1, 'week').startOf('week').add(5, 'days');
          break;
        case 'sunday':
          nextDate.add(1, 'week').startOf('week').add(6, 'days');
          break;
        case 'weekdays':
          // Find next weekday (Monday-Friday)
          nextDate.add(1, 'day');
          while (nextDate.day() === 0 || nextDate.day() === 6) {
            nextDate.add(1, 'day');
          }
          break;
        case 'weekends':
          // Find next weekend (Saturday-Sunday)
          nextDate.add(1, 'day');
          while (nextDate.day() !== 0 && nextDate.day() !== 6) {
            nextDate.add(1, 'day');
          }
          break;
        case 'custom':
          // Handle custom cron expression
          if (task.recursive_custom_pattern) {
            nextDate = this.parseCustomPattern(task.recursive_custom_pattern, currentDate);
          } else {
            return null;
          }
          break;
        default:
          return null;
      }

      // Apply advanced options
      if (task.recursive_skip_weekends) {
        nextDate = this.skipWeekends(nextDate);
      }

      if (task.recursive_skip_holidays) {
        nextDate = this.skipHolidays(nextDate);
      }

      // Check if we've reached the end date
      if (task.recursive_end_date) {
        const endDate = moment(task.recursive_end_date);
        if (nextDate.isAfter(endDate)) {
          return null; // Don't create more tasks after end date
        }
      }

      // Check if we've reached the end count
      if (task.recursive_end_after_count) {
        const completedCount = await this.getCompletedRecursiveTaskCount(task.id);
        if (completedCount >= task.recursive_end_after_count) {
          return null; // Don't create more tasks after count limit
        }
      }

      // Create the next task
      const nextTask = {
        user_id: task.user_id,
        title: task.title,
        description: task.description,
        due_date: nextDate.format('YYYY-MM-DD'),
        time: task.time,
        priority: task.priority,
        tag: task.tag,
        is_revision_task: task.is_revision_task,
        spaced_pattern: task.spaced_pattern,
        is_recursive: task.is_recursive,
        recursive_pattern: task.recursive_pattern,
        recursive_interval: task.recursive_interval,
        recursive_end_date: task.recursive_end_date,
        recursive_end_after: task.recursive_end_after,
        recursive_end_after_count: task.recursive_end_after_count,
        recursive_start_date: task.recursive_start_date,
        recursive_time: task.recursive_time,
        recursive_skip_weekends: task.recursive_skip_weekends,
        recursive_skip_holidays: task.recursive_skip_holidays,
        recursive_custom_pattern: task.recursive_custom_pattern,
        status: 'pending'
      };

      return nextTask;
    } catch (error) {
      logger.error('Error generating next recursive task occurrence:', error);
      return null;
    }
  }

  /**
   * Skip weekends by moving to next weekday
   * @param {moment.Moment} date - The date to adjust
   * @returns {moment.Moment} - Adjusted date
   */
  static skipWeekends(date) {
    const adjustedDate = moment(date);
    while (adjustedDate.day() === 0 || adjustedDate.day() === 6) {
      adjustedDate.add(1, 'day');
    }
    return adjustedDate;
  }

  /**
   * Skip holidays by moving to next business day
   * @param {moment.Moment} date - The date to adjust
   * @returns {moment.Moment} - Adjusted date
   */
  static skipHolidays(date) {
    // This is a simplified implementation
    // In a production system, you would have a holiday calendar
    const adjustedDate = moment(date);
    // For now, just skip weekends
    return this.skipWeekends(adjustedDate);
  }

  /**
   * Parse custom cron expression
   * @param {string} pattern - Cron expression
   * @param {moment.Moment} currentDate - Current date
   * @returns {moment.Moment} - Next occurrence date
   */
  static parseCustomPattern(pattern, currentDate) {
    try {
      // Simple cron parser for basic patterns
      const parts = pattern.split(' ');
      if (parts.length !== 5) {
        return moment(currentDate).add(1, 'day');
      }

      const [minute, hour, day, month, weekday] = parts;
      let nextDate = moment(currentDate);

      // Handle different cron patterns
      if (weekday !== '*') {
        // Specific weekday
        const targetWeekday = parseInt(weekday);
        nextDate.add(1, 'week').startOf('week').add(targetWeekday, 'days');
      } else if (day !== '*') {
        // Specific day of month
        const targetDay = parseInt(day);
        nextDate.date(targetDay);
        if (nextDate.isBefore(currentDate)) {
          nextDate.add(1, 'month');
        }
      } else {
        // Default to next day
        nextDate.add(1, 'day');
      }

      // Set time if specified
      if (hour !== '*') {
        nextDate.hour(parseInt(hour));
      }
      if (minute !== '*') {
        nextDate.minute(parseInt(minute));
      }

      return nextDate;
    } catch (error) {
      logger.error('Error parsing custom pattern:', error);
      return moment(currentDate).add(1, 'day');
    }
  }

  /**
   * Get count of completed recursive tasks
   * @param {number} originalTaskId - Original task ID
   * @returns {number} - Count of completed tasks
   */
  static async getCompletedRecursiveTaskCount(originalTaskId) {
    try {
      const query = `
        SELECT COUNT(*) as count 
        FROM tasks 
        WHERE recursive_original_task_id = ? AND status = 'completed'
      `;
      const result = await dbHelpers.get(query, [originalTaskId]);
      return result ? result.count : 0;
    } catch (error) {
      logger.error('Error getting completed recursive task count:', error);
      return 0;
    }
  }

  /**
   * Create the next occurrence of a recursive task in the database
   * @param {number} taskId - The ID of the completed task
   * @returns {Object|null} - The created task or null if failed
   */
  static async createNextOccurrence(taskId) {
    try {
      // Get the original task
      const originalTask = await dbHelpers.get(
        'SELECT * FROM tasks WHERE task_id = ?',
        [taskId]
      );

      if (!originalTask || !originalTask.is_recursive) {
        return null;
      }

      // Generate next occurrence
      const nextTask = await this.generateNextOccurrence(originalTask);
      if (!nextTask) {
        return null;
      }

      // Insert the next task
      const result = await dbHelpers.run(
        `INSERT INTO tasks (
          user_id, title, description, due_date, time, priority, tag,
          is_revision_task, spaced_pattern, is_recursive, recursive_pattern,
          recursive_interval, recursive_end_date, recursive_end_after, recursive_end_after_count,
          recursive_start_date, recursive_time, recursive_skip_weekends, recursive_skip_holidays,
          recursive_custom_pattern, recursive_original_task_id, recursive_occurrence_count, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nextTask.user_id, nextTask.title, nextTask.description,
          nextTask.due_date, nextTask.time, nextTask.priority, nextTask.tag,
          nextTask.is_revision_task, nextTask.spaced_pattern, nextTask.is_recursive,
          nextTask.recursive_pattern, nextTask.recursive_interval,
          nextTask.recursive_end_date, nextTask.recursive_end_after, nextTask.recursive_end_after_count,
          nextTask.recursive_start_date, nextTask.recursive_time, nextTask.recursive_skip_weekends,
          nextTask.recursive_skip_holidays, nextTask.recursive_custom_pattern,
          originalTask.task_id, (originalTask.recursive_occurrence_count || 0) + 1, nextTask.status
        ]
      );

      // If it's a revision task, create revision entries
      if (nextTask.is_revision_task && nextTask.spaced_pattern) {
        try {
          const intervals = JSON.parse(nextTask.spaced_pattern);
          const baseDate = moment(nextTask.due_date);
          
          for (let i = 0; i < intervals.length; i++) {
            const revisionDate = baseDate.clone().add(intervals[i], 'days').format('YYYY-MM-DD');
            
            await dbHelpers.run(
              'INSERT INTO revisions (task_id, revision_date, revision_number) VALUES (?, ?, ?)',
              [result.lastID, revisionDate, i + 1]
            );
          }
        } catch (error) {
          logger.error(`Error creating revisions for recursive task ${result.lastID}:`, error);
        }
      }

      // Get the created task
      const createdTask = await dbHelpers.get(
        'SELECT * FROM tasks WHERE task_id = ?',
        [result.lastID]
      );

      logger.info(`Created next recursive task occurrence: ${createdTask.task_id}`);
      return createdTask;
    } catch (error) {
      logger.error('Error creating next recursive task occurrence:', error);
      return null;
    }
  }

  /**
   * Process all completed recursive tasks and generate next occurrences
   * This should be called by a scheduled job
   */
  static async processCompletedRecursiveTasks() {
    try {
      // Find all completed recursive tasks from yesterday or earlier
      const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');
      
      const completedTasks = await dbHelpers.all(
        `SELECT * FROM tasks 
         WHERE is_recursive = 1 
         AND status = 'completed' 
         AND due_date <= ? 
         AND NOT EXISTS (
           SELECT 1 FROM tasks t2 
           WHERE t2.title = tasks.title 
           AND t2.user_id = tasks.user_id 
           AND t2.due_date > tasks.due_date
           AND t2.is_recursive = 1
         )`,
        [yesterday]
      );

      let createdCount = 0;
      for (const task of completedTasks) {
        const nextTask = await this.createNextOccurrence(task.task_id);
        if (nextTask) {
          createdCount++;
        }
      }

      logger.info(`Processed ${completedTasks.length} completed recursive tasks, created ${createdCount} new occurrences`);
      return createdCount;
    } catch (error) {
      logger.error('Error processing completed recursive tasks:', error);
      return 0;
    }
  }

  /**
   * Get all recursive tasks for a user
   * @param {number} userId - The user ID
   * @returns {Array} - Array of recursive tasks
   */
  static async getUserRecursiveTasks(userId) {
    try {
      const tasks = await dbHelpers.all(
        'SELECT * FROM tasks WHERE user_id = ? AND is_recursive = 1 ORDER BY due_date ASC',
        [userId]
      );
      return tasks;
    } catch (error) {
      logger.error('Error fetching user recursive tasks:', error);
      return [];
    }
  }

  /**
   * Update recursive task settings
   * @param {number} taskId - The task ID
   * @param {Object} settings - The recursive settings
   * @returns {boolean} - Success status
   */
  static async updateRecursiveSettings(taskId, settings) {
    try {
      const { 
        is_recursive, 
        recursive_pattern, 
        recursive_interval, 
        recursive_end_date,
        recursive_end_after,
        recursive_end_after_count,
        recursive_start_date,
        recursive_time,
        recursive_skip_weekends,
        recursive_skip_holidays,
        recursive_custom_pattern
      } = settings;
      
      await dbHelpers.run(
        `UPDATE tasks 
         SET is_recursive = ?, 
             recursive_pattern = ?, 
             recursive_interval = ?, 
             recursive_end_date = ?,
             recursive_end_after = ?,
             recursive_end_after_count = ?,
             recursive_start_date = ?,
             recursive_time = ?,
             recursive_skip_weekends = ?,
             recursive_skip_holidays = ?,
             recursive_custom_pattern = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE task_id = ?`,
        [
          is_recursive, 
          recursive_pattern, 
          recursive_interval, 
          recursive_end_date,
          recursive_end_after,
          recursive_end_after_count,
          recursive_start_date,
          recursive_time,
          recursive_skip_weekends,
          recursive_skip_holidays,
          recursive_custom_pattern,
          taskId
        ]
      );

      logger.info(`Updated recursive settings for task ${taskId}`);
      return true;
    } catch (error) {
      logger.error('Error updating recursive task settings:', error);
      return false;
    }
  }
} 