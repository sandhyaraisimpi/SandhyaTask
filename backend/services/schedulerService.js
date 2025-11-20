import cron from 'node-cron';
import { RecursiveTaskService } from './recursiveTaskService.js';
import { logger } from '../utils/logger.js';

/**
 * Scheduler Service
 * Handles all scheduled jobs and automated tasks
 */

export class SchedulerService {
  constructor() {
    this.jobs = new Map();
  }

  /**
   * Initialize all scheduled jobs
   */
  async initialize() {
    try {
      // Schedule recursive task processing - runs daily at 2 AM
      this.scheduleRecursiveTaskProcessing();
      
      // Schedule PDF reminder generation - runs daily at 6 AM
      this.schedulePDFReminderGeneration();
      
      logger.info('Scheduler service initialized successfully');
    } catch (error) {
      logger.error('Error initializing scheduler service:', error);
    }
  }

  /**
   * Schedule recursive task processing
   * Runs daily at 2 AM to process completed recursive tasks
   */
  scheduleRecursiveTaskProcessing() {
    const job = cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('Starting recursive task processing job');
        const createdCount = await RecursiveTaskService.processCompletedRecursiveTasks();
        logger.info(`Recursive task processing completed. Created ${createdCount} new tasks.`);
      } catch (error) {
        logger.error('Error in recursive task processing job:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.jobs.set('recursiveTaskProcessing', job);
    logger.info('Scheduled recursive task processing job (daily at 2 AM UTC)');
  }

  /**
   * Schedule PDF reminder generation
   * Runs daily at 6 AM to generate and send PDF reminders
   */
  schedulePDFReminderGeneration() {
    const job = cron.schedule('0 6 * * *', async () => {
      try {
        logger.info('Starting PDF reminder generation job');
        // TODO: Implement PDF reminder generation
        // await PDFReminderService.generateAndSendReminders();
        logger.info('PDF reminder generation completed');
      } catch (error) {
        logger.error('Error in PDF reminder generation job:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.jobs.set('pdfReminderGeneration', job);
    logger.info('Scheduled PDF reminder generation job (daily at 6 AM UTC)');
  }

  /**
   * Manually trigger recursive task processing
   * Useful for testing or immediate processing
   */
  async triggerRecursiveTaskProcessing() {
    try {
      logger.info('Manually triggering recursive task processing');
      const createdCount = await RecursiveTaskService.processCompletedRecursiveTasks();
      logger.info(`Manual recursive task processing completed. Created ${createdCount} new tasks.`);
      return createdCount;
    } catch (error) {
      logger.error('Error in manual recursive task processing:', error);
      throw error;
    }
  }

  /**
   * Get status of all scheduled jobs
   */
  getJobStatus() {
    const status = {};
    for (const [name, job] of this.jobs) {
      status[name] = {
        running: job.running,
        nextDate: job.nextDate(),
        lastDate: job.lastDate()
      };
    }
    return status;
  }

  /**
   * Stop all scheduled jobs
   */
  stopAllJobs() {
    for (const [name, job] of this.jobs) {
      job.stop();
      logger.info(`Stopped scheduled job: ${name}`);
    }
    this.jobs.clear();
  }

  /**
   * Stop a specific job
   * @param {string} jobName - Name of the job to stop
   */
  stopJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      this.jobs.delete(jobName);
      logger.info(`Stopped scheduled job: ${jobName}`);
      return true;
    }
    return false;
  }

  /**
   * Start a specific job
   * @param {string} jobName - Name of the job to start
   */
  startJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      logger.info(`Started scheduled job: ${jobName}`);
      return true;
    }
    return false;
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService(); 