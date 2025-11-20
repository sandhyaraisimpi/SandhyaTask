import moment from 'moment';
import { dbHelpers } from '../config/database.js';
import { logger } from '../utils/logger.js';

export class RevisionService {
  static defaultSpacedIntervals = [1, 3, 7, 14, 30, 45, 60, 75, 90]; // Default spaced intervals in days

  /**
   * Generate revision dates for a task
   * @param {Object} task - The original task
   * @returns {Array} Array of dates for revisions
   */
  static async generateRevisionDates(task) {
    try {
      if (!task.is_revision_task) {
        return [];
      }

      const startDate = moment(task.due_date);
      const intervals = task.spaced_intervals || this.defaultSpacedIntervals;
      
      // Generate dates for each interval
      const revisionDates = intervals.map(interval => {
        return startDate.clone().add(interval, 'days').format('YYYY-MM-DD');
      });

      // Create revision records
      const values = revisionDates.map((date, index) => ({
        task_id: task.task_id,
        due_date: date,
        interval_days: intervals[index],
        status: 'pending'
      }));

      // Insert all revisions
      for (const value of values) {
        await dbHelpers.run(
          `INSERT INTO revisions (task_id, due_date, interval_days, status)
           VALUES (?, ?, ?, ?)`,
          [value.task_id, value.due_date, value.interval_days, value.status]
        );
      }

      logger.info(`Generated ${values.length} revision dates for task ${task.task_id}`);
      return revisionDates;
    } catch (error) {
      logger.error('Error generating revision dates:', error);
      throw error;
    }
  }

  /**
   * Get all revision dates for a task
   * @param {string} taskId - The task ID
   * @returns {Array} Array of revision records
   */
  static async getRevisionDates(taskId) {
    return await dbHelpers.all(
      `SELECT * FROM revisions WHERE task_id = ? ORDER BY due_date`,
      [taskId]
    );
  }
}