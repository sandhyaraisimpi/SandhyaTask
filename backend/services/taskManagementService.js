import moment from 'moment';
import { dbHelpers } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { RecursiveTaskService } from './recursiveTaskService.js';

/**
 * Task Management Service
 * 
 * Handles intelligent task management with past-date protection.
 * Modular design ensures no impact on other code.
 */

export class TaskManagementService {
  /**
   * Determine if a task can be safely deleted
   * @param {Object} task - Task object with due_date and status
   * @returns {Object} { canDelete, reason, shouldReschedule }
   */
  static canDeleteTask(task) {
    // Handle null/undefined task
    if (!task || !task.due_date) {
      console.log(`[TaskManagement] Invalid task for deletion check`);
      return { canDelete: true, reason: null, shouldReschedule: false };
    }

    const today = moment().startOf('day');
    
    // Parse due_date - handle multiple formats
    let dueDate = moment(task.due_date);
    
    // If moment parsing failed, try parsing as string
    if (!dueDate.isValid()) {
      console.log(`[TaskManagement] Invalid due_date format: "${task.due_date}"`);
      dueDate = moment(task.due_date, 'YYYY-MM-DD');
    }
    
    if (!dueDate.isValid()) {
      console.log(`[TaskManagement] Could not parse due_date: "${task.due_date}"`);
      return { canDelete: true, reason: null, shouldReschedule: false };
    }
    
    dueDate = dueDate.startOf('day');
    const isPastDate = dueDate.isBefore(today);

    // DEBUG: Log the check
    console.log(`\n[TaskManagement] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[TaskManagement] Checking task ${task.task_id || 'unknown'}:`);
    console.log(`  Title: ${task.title || 'N/A'}`);
    console.log(`  Due Date: ${dueDate.format('YYYY-MM-DD')} | Today: ${today.format('YYYY-MM-DD')} | Status: "${task.status}"`);
    console.log(`  Is Past: ${isPastDate}`);

    // Key Fix: Check for ANY non-completed status, not just pending
    const isCompleted = (task.status === 'completed' || task.status === 'done');
    
    if (isCompleted) {
      console.log(`  ✅ Result: CAN DELETE (completed)`);
      console.log(`[TaskManagement] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return { canDelete: true, reason: null, shouldReschedule: false };
    }

    // CRITICAL FIX: Past uncompleted tasks CANNOT be deleted - must reschedule
    if (isPastDate) {
      console.log(`  🛡️  Result: CANNOT DELETE (past & uncompleted - will reschedule)`);
      console.log(`[TaskManagement] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return {
        canDelete: false,
        reason: 'Past-dated uncompleted tasks cannot be deleted. They will be rescheduled.',
        shouldReschedule: true
      };
    }

    // Future tasks can be deleted
    console.log(`  ✅ Result: CAN DELETE (future)`);
    console.log(`[TaskManagement] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return { canDelete: true, reason: null, shouldReschedule: false };
  }

  /**
   * Reschedule a task and auto-schedule related revisions/recursive instances
   * @param {number} taskId - Task ID to reschedule
   * @param {string} newDate - New date (YYYY-MM-DD). If null, uses tomorrow
   * @returns {Promise<Object>} Rescheduled task with related schedules
   */
  static async rescheduleTask(taskId, newDate = null) {
    try {
      // Get the task
      const task = await dbHelpers.get(
        'SELECT * FROM tasks WHERE task_id = ?',
        [taskId]
      );

      if (!task) {
        return { success: false, error: 'Task not found' };
      }

      // Determine new date
      const rescheduleTo = newDate 
        ? moment(newDate) 
        : moment().add(1, 'day'); // Default: tomorrow

      // Validate that the new date is not in the past
      const today = moment().startOf('day');
      if (rescheduleTo.isBefore(today)) {
        return { 
          success: false, 
          error: 'Cannot reschedule to a past date. Please select today or a future date.' 
        };
      }

      const newDateStr = rescheduleTo.format('YYYY-MM-DD');

      // Update task date
      await dbHelpers.run(
        'UPDATE tasks SET due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?',
        [newDateStr, taskId]
      );

      logger.info(`[TaskManagement] Task ${taskId} rescheduled to ${newDateStr}`);

      // Handle revision tasks
      const revisions = task.is_revision_task 
        ? await this.scheduleRevisions(taskId, task, newDateStr)
        : [];

      // Handle recursive tasks
      const recursiveInstances = task.is_recursive
        ? await this.scheduleRecursiveInstances(taskId, task, newDateStr)
        : [];

      return {
        success: true,
        task: { ...task, due_date: newDateStr },
        revisions,
        recursiveInstances
      };
    } catch (error) {
      logger.error(`[TaskManagement] Error rescheduling task ${taskId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Schedule upcoming revisions based on spaced pattern
   * @private
   */
  static async scheduleRevisions(taskId, task, newDateStr) {
    try {
      if (!task.spaced_pattern) return [];

      const baseDate = moment(newDateStr);
      const createdRevisions = [];

      // Parse spaced pattern
      const intervals = this.parseSpacedPattern(task.spaced_pattern);

      // Get highest revision number
      const lastRev = await dbHelpers.get(
        'SELECT MAX(revision_number) as maxNum FROM revisions WHERE task_id = ?',
        [taskId]
      );

      let revNum = (lastRev?.maxNum || 1) + 1;

      // Create revisions
      for (const interval of intervals) {
        const revisionDate = baseDate.clone().add(interval.days, 'days');

        await dbHelpers.run(
          `INSERT INTO revisions (task_id, revision_number, revision_date, completed, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            taskId,
            revNum,
            revisionDate.format('YYYY-MM-DD'),
            0,
            moment().format('YYYY-MM-DD HH:mm:ss'),
            moment().format('YYYY-MM-DD HH:mm:ss')
          ]
        );

        logger.info(`[TaskManagement] Created revision ${revNum} for task ${taskId}`);
        createdRevisions.push({
          revision_number: revNum,
          revision_date: revisionDate.format('YYYY-MM-DD')
        });

        revNum++;
      }

      return createdRevisions;
    } catch (error) {
      logger.error(`[TaskManagement] Error scheduling revisions:`, error);
      return [];
    }
  }

  /**
   * Schedule upcoming recursive instances
   * @private
   */
  static async scheduleRecursiveInstances(taskId, task, newDateStr) {
    try {
      const createdInstances = [];
      const baseDate = moment(newDateStr);

      // Create temporary task object for generation
      const tempTask = { ...task, due_date: newDateStr };

      let currentTask = tempTask;
      let generatedCount = 0;
      const maxGenerate = 10;

      // Generate next occurrences
      while (generatedCount < maxGenerate) {
        const nextOcc = await RecursiveTaskService.generateNextOccurrence(currentTask);

        if (!nextOcc) break;

        // Insert recursive instance
        await dbHelpers.run(
          `INSERT INTO tasks (
            user_id, title, description, due_date, time, priority, tag,
            is_revision_task, is_recursive, recursive_pattern, recursive_interval,
            recursive_end_date, recursive_end_after_count, recursive_start_date,
            recursive_skip_weekends, recursive_skip_holidays, recursive_custom_pattern,
            recursive_original_task_id, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nextOcc.user_id,
            nextOcc.title,
            nextOcc.description,
            nextOcc.due_date,
            nextOcc.time,
            nextOcc.priority,
            nextOcc.tag,
            nextOcc.is_revision_task ? 1 : 0,
            nextOcc.is_recursive ? 1 : 0,
            nextOcc.recursive_pattern,
            nextOcc.recursive_interval,
            nextOcc.recursive_end_date,
            nextOcc.recursive_end_after_count,
            nextOcc.recursive_start_date,
            nextOcc.recursive_skip_weekends ? 1 : 0,
            nextOcc.recursive_skip_holidays ? 1 : 0,
            nextOcc.recursive_custom_pattern,
            task.recursive_original_task_id || taskId,
            nextOcc.status,
            moment().format('YYYY-MM-DD HH:mm:ss'),
            moment().format('YYYY-MM-DD HH:mm:ss')
          ]
        );

        logger.info(`[TaskManagement] Created recursive instance on ${nextOcc.due_date}`);
        createdInstances.push({
          due_date: nextOcc.due_date,
          title: nextOcc.title
        });

        currentTask = { ...nextOcc };
        generatedCount++;
      }

      return createdInstances;
    } catch (error) {
      logger.error(`[TaskManagement] Error scheduling recursive instances:`, error);
      return [];
    }
  }

  /**
   * Parse spaced pattern string (e.g., "[1,3,7,14]" or "1d, 3d, 7d, 14d")
   * @private
   */
  static parseSpacedPattern(pattern) {
    if (!pattern) return [];

    try {
      // Handle JSON array format: [1,3,7,14]
      if (pattern.trim().startsWith('[')) {
        const intervals = JSON.parse(pattern);
        return intervals.map(days => ({ days, label: `${days}d` }));
      }

      // Handle string format: "1d, 3d, 7d, 14d"
      const intervals = [];
      const parts = pattern.split(',').map(p => p.trim());

      for (const part of parts) {
        const match = part.match(/(\d+)([dhwm])/i);
        if (match) {
          const num = parseInt(match[1]);
          const unit = match[2].toLowerCase();

          let days = num;
          switch (unit) {
            case 'd': days = num; break;
            case 'h': days = num / 24; break;
            case 'w': days = num * 7; break;
            case 'm': days = num * 30; break;
          }

          intervals.push({ days, label: `${num}${unit}` });
        }
      }

      return intervals;
    } catch (error) {
      logger.error(`[TaskManagement] Error parsing pattern:`, error);
      return [];
    }
  }

  /**
   * Get all past uncompleted tasks for a user
   */
  static async getPastUncompletedTasks(userId) {
    try {
      const today = moment().format('YYYY-MM-DD');
      
      return await dbHelpers.all(
        `SELECT * FROM tasks 
         WHERE user_id = ? AND due_date < ? AND status != 'completed'
         ORDER BY due_date ASC`,
        [userId, today]
      ) || [];
    } catch (error) {
      logger.error(`[TaskManagement] Error fetching past tasks:`, error);
      return [];
    }
  }
}

export default TaskManagementService;
