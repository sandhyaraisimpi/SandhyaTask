import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { dbHelpers } from '../config/database.js';
import { verifyToken, requireAuth, requireOwnership } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logHelpers } from '../utils/logger.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import moment from 'moment';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyToken);

// Get all tasks for user
router.get('/',
  [
    query('status').optional().isIn(['pending', 'completed', 'overdue']),
    query('type').optional().isIn(['regular', 'revision']),
    query('date').optional().isISO8601(),
    query('search').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { status, type, date, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let whereConditions = ['t.user_id = ?'];
    let params = [req.user.user_id];

    // Add filters
    if (status) {
      whereConditions.push('t.status = ?');
      params.push(status);
    }

    if (type === 'revision') {
      whereConditions.push('t.is_revision_task = TRUE');
    } else if (type === 'regular') {
      whereConditions.push('t.is_revision_task = FALSE');
    }

    if (date) {
      whereConditions.push('t.due_date = ?');
      params.push(date);
    }

    if (search) {
      whereConditions.push('(t.title LIKE ? OR t.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    // Build query
    const whereClause = whereConditions.join(' AND ');
    
    // Get total count
    const countResult = await dbHelpers.get(
      `SELECT COUNT(*) as total FROM tasks t WHERE ${whereClause}`,
      params
    );

    // Get tasks with pagination
    const tasks = await dbHelpers.all(
      `SELECT 
        t.task_id,
        t.title,
        t.description,
        t.due_date,
        t.time,
        t.priority,
        t.tag,
        t.is_revision_task,
        t.spaced_pattern,
        t.is_recursive,
        t.recursive_pattern,
        t.recursive_interval,
        t.recursive_end_date,
        t.recursive_end_after,
        t.recursive_end_after_count,
        t.recursive_start_date,
        t.recursive_time,
        t.recursive_skip_weekends,
        t.recursive_skip_holidays,
        t.recursive_custom_pattern,
        t.recursive_original_task_id,
        t.recursive_occurrence_count,
        t.status,
        t.created_at,
        t.updated_at,
        COUNT(r.revision_id) as revision_count
      FROM tasks t
      LEFT JOIN revisions r ON t.task_id = r.task_id
      WHERE ${whereClause}
      GROUP BY t.task_id
      ORDER BY t.due_date ASC, t.time ASC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Get today's tasks count
    const todayTasks = await dbHelpers.get(
      'SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND due_date = DATE("now")',
      [req.user.user_id]
    );

    // Get overdue tasks count
    const overdueTasks = await dbHelpers.get(
      'SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND due_date < DATE("now") AND status = "pending"',
      [req.user.user_id]
    );

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          pages: Math.ceil(countResult.total / limit)
        },
        summary: {
          today: todayTasks.count,
          overdue: overdueTasks.count
        }
      }
    });
  })
);

// Get task by ID
router.get('/:taskId',
  requireOwnership('tasks', 'taskId'),
  asyncHandler(async (req, res) => {
    const { taskId } = req.params;

    const task = await dbHelpers.get(
      `SELECT 
        t.*,
        COUNT(r.revision_id) as revision_count
      FROM tasks t
      LEFT JOIN revisions r ON t.task_id = r.task_id
      WHERE t.task_id = ? AND t.user_id = ?
      GROUP BY t.task_id`,
      [taskId, req.user.user_id]
    );

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    // Get revisions for this task
    const revisions = await dbHelpers.all(
      'SELECT * FROM revisions WHERE task_id = ? ORDER BY revision_date ASC',
      [taskId]
    );

    res.json({
      success: true,
      data: {
        task: {
          ...task,
          revisions
        }
      }
    });
  })
);

// Create new task
router.post('/',
  [
    body('title').trim().isLength({ min: 1, max: 255 }).withMessage('Title is required and must be less than 255 characters'),
    body('description').optional().isString(),
    body('due_date').isISO8601().withMessage('Valid due date is required'),
    body('time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format'),
    body('priority').optional().isIn(['low', 'medium', 'high']),
    body('tag').optional().isString().isLength({ max: 50 }),
    body('is_revision_task').optional().isBoolean(),
    body('spaced_pattern').optional().isString(),
    body('is_recursive').optional().isBoolean(),
    body('recursive_pattern').optional().isIn(['daily', 'weekly', 'monthly', 'yearly', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'weekdays', 'weekends', 'biweekly', 'quarterly', 'semiannual', 'custom']),
    body('recursive_interval').optional().isInt({ min: 1 }),
    body('recursive_end_date').optional().isISO8601(),
    body('recursive_end_after').optional().isIn(['never', 'date', 'count']),
    body('recursive_end_after_count').optional().isInt({ min: 1, max: 1000 }),
    body('recursive_start_date').optional().isISO8601(),
    body('recursive_time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('recursive_skip_weekends').optional().isBoolean(),
    body('recursive_skip_holidays').optional().isBoolean(),
    body('recursive_custom_pattern').optional().isString()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const {
      title,
      description,
      due_date,
      time,
      priority = 'medium',
      tag,
      is_revision_task = false,
      spaced_pattern = '[1,3,7,14]',
      is_recursive = false,
      recursive_pattern,
      recursive_interval = 1,
      recursive_end_date,
      recursive_end_after = 'never',
      recursive_end_after_count = 0,
      recursive_start_date,
      recursive_time,
      recursive_skip_weekends = false,
      recursive_skip_holidays = false,
      recursive_custom_pattern
    } = req.body;

    // Check if task already exists for this user on this date
    const existingTask = await dbHelpers.get(
      'SELECT task_id FROM tasks WHERE user_id = ? AND title = ? AND due_date = ?',
      [req.user.user_id, title, due_date]
    );

    if (existingTask) {
      throw new ValidationError('A task with this title already exists on this date');
    }

    // Insert task
    const result = await dbHelpers.run(
      `INSERT INTO tasks (
        user_id, title, description, due_date, time, priority, tag, 
        is_revision_task, spaced_pattern, is_recursive, recursive_pattern, 
        recursive_interval, recursive_end_date, recursive_end_after, 
        recursive_end_after_count, recursive_start_date, recursive_time,
        recursive_skip_weekends, recursive_skip_holidays, recursive_custom_pattern, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.user_id, title, description, due_date, time, priority, tag, is_revision_task, spaced_pattern, 
       is_recursive, recursive_pattern, recursive_interval, recursive_end_date, recursive_end_after, 
       recursive_end_after_count, recursive_start_date, recursive_time, recursive_skip_weekends, 
       recursive_skip_holidays, recursive_custom_pattern, 'pending']
    );

    // If it's a revision task, create revision entries
    if (is_revision_task) {
      try {
        const intervals = JSON.parse(spaced_pattern);
        const baseDate = moment(due_date);
        
        for (let i = 0; i < intervals.length; i++) {
          const revisionDate = baseDate.clone().add(intervals[i], 'days').format('YYYY-MM-DD');
          
          await dbHelpers.run(
            'INSERT INTO revisions (task_id, revision_date, revision_number) VALUES (?, ?, ?)',
            [result.lastID, revisionDate, i + 1]
          );
        }
      } catch (error) {
        // If spaced pattern is invalid, continue without revisions
        logHelpers.logError(new Error(`Invalid spaced pattern for task ${result.lastID}: ${spaced_pattern}`));
      }
    }

    // Get created task
    const task = await dbHelpers.get(
      'SELECT * FROM tasks WHERE task_id = ?',
      [result.lastID]
    );

    logHelpers.logDatabase('create', 'tasks', 0, true);
    
    res.status(201).json({
      success: true,
      data: { task }
    });
  })
);

// Update task
router.put('/:taskId',
  requireOwnership('tasks', 'taskId'),
  [
    body('title').optional().trim().isLength({ min: 1, max: 255 }),
    body('description').optional().isString(),
    body('due_date').optional().isISO8601(),
    body('time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('priority').optional().isIn(['low', 'medium', 'high']),
    body('tag').optional().isString().isLength({ max: 50 }),
    body('status').optional().isIn(['pending', 'completed', 'overdue']),
    body('is_recursive').optional().isBoolean(),
    body('recursive_pattern').optional().isIn(['daily', 'weekly', 'monthly', 'yearly', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'weekdays', 'weekends', 'biweekly', 'quarterly', 'semiannual', 'custom']),
    body('recursive_interval').optional().isInt({ min: 1 }),
    body('recursive_end_date').optional().isISO8601(),
    body('recursive_end_after').optional().isIn(['never', 'date', 'count']),
    body('recursive_end_after_count').optional().isInt({ min: 1, max: 1000 }),
    body('recursive_start_date').optional().isISO8601(),
    body('recursive_time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('recursive_skip_weekends').optional().isBoolean(),
    body('recursive_skip_holidays').optional().isBoolean(),
    body('recursive_custom_pattern').optional().isString()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { taskId } = req.params;
    const updates = [];
    const params = [];

    // Build update query
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    });

    if (updates.length === 0) {
      throw new ValidationError('No fields to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(taskId);

    await dbHelpers.run(
      `UPDATE tasks SET ${updates.join(', ')} WHERE task_id = ?`,
      params
    );

    // Get updated task
    const task = await dbHelpers.get(
      'SELECT * FROM tasks WHERE task_id = ?',
      [taskId]
    );

    logHelpers.logDatabase('update', 'tasks', 0, true);
    
    res.json({
      success: true,
      data: { task }
    });
  })
);

// Delete task
router.delete('/:taskId',
  requireOwnership('tasks', 'taskId'),
  asyncHandler(async (req, res) => {
    const { taskId } = req.params;

    // Delete task (revisions will be deleted via cascade)
    await dbHelpers.run(
      'DELETE FROM tasks WHERE task_id = ?',
      [taskId]
    );

    logHelpers.logDatabase('delete', 'tasks', 0, true);
    
    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  })
);

// Mark task as completed
router.patch('/:taskId/complete',
  requireOwnership('tasks', 'taskId'),
  asyncHandler(async (req, res) => {
    const { taskId } = req.params;

    await dbHelpers.run(
      'UPDATE tasks SET status = "completed", updated_at = CURRENT_TIMESTAMP WHERE task_id = ?',
      [taskId]
    );

    // Get updated task
    const task = await dbHelpers.get(
      'SELECT * FROM tasks WHERE task_id = ?',
      [taskId]
    );

    logHelpers.logDatabase('complete', 'tasks', 0, true);
    
    res.json({
      success: true,
      data: { task }
    });
  })
);

// Get today's tasks
router.get('/today/list',
  asyncHandler(async (req, res) => {
    const tasks = await dbHelpers.all(
      `SELECT 
        t.*,
        COUNT(r.revision_id) as revision_count
      FROM tasks t
      LEFT JOIN revisions r ON t.task_id = r.task_id
      WHERE t.user_id = ? AND t.due_date = DATE("now")
      GROUP BY t.task_id
      ORDER BY t.time ASC, t.created_at ASC`,
      [req.user.user_id]
    );

    res.json({
      success: true,
      data: { tasks }
    });
  })
);

// Get overdue tasks
router.get('/overdue/list',
  asyncHandler(async (req, res) => {
    const tasks = await dbHelpers.all(
      `SELECT 
        t.*,
        COUNT(r.revision_id) as revision_count
      FROM tasks t
      LEFT JOIN revisions r ON t.task_id = r.task_id
      WHERE t.user_id = ? AND t.due_date < DATE("now") AND t.status = "pending"
      GROUP BY t.task_id
      ORDER BY t.due_date ASC`,
      [req.user.user_id]
    );

    res.json({
      success: true,
      data: { tasks }
    });
  })
);

// Bulk operations
router.post('/bulk',
  [
    body('action').isIn(['complete', 'delete', 'reschedule']),
    body('taskIds').isArray({ min: 1 }),
    body('taskIds.*').isInt(),
    body('newDate').optional().isISO8601()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { action, taskIds, newDate } = req.body;

    // Verify all tasks belong to user
    const userTasks = await dbHelpers.all(
      'SELECT task_id FROM tasks WHERE task_id IN (' + taskIds.map(() => '?').join(',') + ') AND user_id = ?',
      [...taskIds, req.user.user_id]
    );

    if (userTasks.length !== taskIds.length) {
      throw new ValidationError('Some tasks do not belong to you');
    }

    let result;
    switch (action) {
      case 'complete':
        result = await dbHelpers.run(
          'UPDATE tasks SET status = "completed", updated_at = CURRENT_TIMESTAMP WHERE task_id IN (' + taskIds.map(() => '?').join(',') + ')',
          taskIds
        );
        break;
      case 'delete':
        result = await dbHelpers.run(
          'DELETE FROM tasks WHERE task_id IN (' + taskIds.map(() => '?').join(',') + ')',
          taskIds
        );
        break;
      case 'reschedule':
        if (!newDate) {
          throw new ValidationError('New date is required for reschedule action');
        }
        result = await dbHelpers.run(
          'UPDATE tasks SET due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE task_id IN (' + taskIds.map(() => '?').join(',') + ')',
          [newDate, ...taskIds]
        );
        break;
    }

    logHelpers.logDatabase(`bulk_${action}`, 'tasks', 0, true);
    
    res.json({
      success: true,
      message: `Bulk ${action} completed successfully`,
      data: { affectedRows: result.changes }
    });
  })
);

// Get recursive tasks for a user
router.get('/recursive',
  requireAuth,
  asyncHandler(async (req, res) => {
    const tasks = await dbHelpers.all(
      `SELECT 
        task_id,
        title,
        description,
        due_date,
        time,
        priority,
        tag,
        is_revision_task,
        spaced_pattern,
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
        recursive_original_task_id,
        recursive_occurrence_count,
        status,
        created_at,
        updated_at
      FROM tasks 
      WHERE user_id = ? AND is_recursive = 1 
      ORDER BY due_date ASC`,
      [req.user.user_id]
    );

    res.json({
      success: true,
      data: { tasks }
    });
  })
);

// Generate next occurrence of a recursive task
router.post('/:taskId/generate-next',
  requireOwnership('tasks', 'taskId'),
  asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    
    // Import the service here to avoid circular dependencies
    const { RecursiveTaskService } = await import('../services/recursiveTaskService.js');
    
    const nextTask = await RecursiveTaskService.createNextOccurrence(taskId);
    
    if (!nextTask) {
      throw new ValidationError('Could not generate next occurrence for this task');
    }

    res.status(201).json({
      success: true,
      data: { task: nextTask }
    });
  })
);

// Update recursive task settings
router.put('/:taskId/recursive-settings',
  requireOwnership('tasks', 'taskId'),
  [
    body('is_recursive').optional().isBoolean(),
    body('recursive_pattern').optional().isIn(['daily', 'weekly', 'monthly', 'yearly', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'weekdays', 'weekends', 'biweekly', 'quarterly', 'semiannual', 'custom']),
    body('recursive_interval').optional().isInt({ min: 1 }),
    body('recursive_end_date').optional().isISO8601(),
    body('recursive_end_after').optional().isIn(['never', 'date', 'count']),
    body('recursive_end_after_count').optional().isInt({ min: 1, max: 1000 }),
    body('recursive_start_date').optional().isISO8601(),
    body('recursive_time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('recursive_skip_weekends').optional().isBoolean(),
    body('recursive_skip_holidays').optional().isBoolean(),
    body('recursive_custom_pattern').optional().isString()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { taskId } = req.params;
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
    } = req.body;
    
    // Import the service here to avoid circular dependencies
    const { RecursiveTaskService } = await import('../services/recursiveTaskService.js');
    
    const success = await RecursiveTaskService.updateRecursiveSettings(taskId, {
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
    });

    if (!success) {
      throw new ValidationError('Failed to update recursive settings');
    }

    // Get updated task
    const task = await dbHelpers.get(
      'SELECT * FROM tasks WHERE task_id = ?',
      [taskId]
    );

    res.json({
      success: true,
      data: { task }
    });
  })
);

// Manually trigger recursive task processing (admin/testing endpoint)
router.post('/trigger-recursive-processing',
  requireAuth,
  asyncHandler(async (req, res) => {
    // Import the service here to avoid circular dependencies
    const { schedulerService } = await import('../services/schedulerService.js');
    
    const createdCount = await schedulerService.triggerRecursiveTaskProcessing();

    res.json({
      success: true,
      data: { 
        message: 'Recursive task processing completed',
        createdCount 
      }
    });
  })
);

// Get scheduler job status
router.get('/scheduler/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    // Import the service here to avoid circular dependencies
    const { schedulerService } = await import('../services/schedulerService.js');
    
    const status = schedulerService.getJobStatus();

    res.json({
      success: true,
      data: { status }
    });
  })
);

export default router; 