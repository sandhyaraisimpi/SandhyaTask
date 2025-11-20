import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { dbHelpers } from '../config/database.js';
import { verifyToken, requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import moment from 'moment';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'revisions');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `revision-${req.params.revisionId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPEG, PNG files are allowed.'));
    }
  }
});

// Apply authentication middleware to all routes
router.use(verifyToken);

// Get all revisions for user
router.get('/',
  [
    query('status').optional().isIn(['pending', 'completed', 'overdue']),
    query('date').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { status, date, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let whereConditions = ['t.user_id = ?'];
    let params = [req.user.user_id];

    // Add filters
    if (status === 'completed') {
      whereConditions.push('r.completed = TRUE');
    } else if (status === 'pending') {
      whereConditions.push('r.completed = FALSE');
    } else if (status === 'overdue') {
      whereConditions.push('r.completed = FALSE AND r.revision_date < DATE("now")');
    }

    if (date) {
      whereConditions.push('r.revision_date = ?');
      params.push(date);
    }

    // Build query
    const whereClause = whereConditions.join(' AND ');
    
    // Get total count
    const countResult = await dbHelpers.get(
      `SELECT COUNT(*) as total FROM revisions r
       JOIN tasks t ON r.task_id = t.task_id
       WHERE ${whereClause}`,
      params
    );

    // Get revisions with task details
    const revisions = await dbHelpers.all(
      `SELECT 
        r.revision_id,
        r.task_id,
        r.revision_date,
        r.revision_number,
        r.completed,
        r.completed_at,
        r.created_at,
        t.title as task_title,
        t.description as task_description,
        t.priority,
        t.tag
      FROM revisions r
      JOIN tasks t ON r.task_id = t.task_id
      WHERE ${whereClause}
      ORDER BY r.revision_date ASC, r.revision_number ASC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: {
        revisions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          pages: Math.ceil(countResult.total / limit)
        }
      }
    });
  })
);

// Get revisions for a specific task
router.get('/task/:taskId',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { taskId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Verify task ownership
    const task = await dbHelpers.get(
      'SELECT task_id, title FROM tasks WHERE task_id = ? AND user_id = ?',
      [taskId, req.user.user_id]
    );

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    // Get revisions for the task
    const revisions = await dbHelpers.all(
      `SELECT 
        revision_id,
        revision_date,
        revision_number,
        completed,
        completed_at,
        created_at
      FROM revisions 
      WHERE task_id = ?
      ORDER BY revision_date ASC, revision_number ASC
      LIMIT ? OFFSET ?`,
      [taskId, limit, offset]
    );

    // Get total count
    const countResult = await dbHelpers.get(
      'SELECT COUNT(*) as total FROM revisions WHERE task_id = ?',
      [taskId]
    );

    res.json({
      success: true,
      data: {
        task,
        revisions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          pages: Math.ceil(countResult.total / limit)
        }
      }
    });
  })
);

// Mark revision as completed
router.patch('/:revisionId/complete',
  [
    body('completed_at').optional().isISO8601()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { revisionId } = req.params;
    const { completed_at } = req.body;

    // Verify revision ownership
    const revision = await dbHelpers.get(
      `SELECT r.revision_id, r.completed, t.title 
       FROM revisions r
       JOIN tasks t ON r.task_id = t.task_id
       WHERE r.revision_id = ? AND t.user_id = ?`,
      [revisionId, req.user.user_id]
    );

    if (!revision) {
      throw new NotFoundError('Revision not found');
    }

    if (revision.completed) {
      throw new ValidationError('Revision is already completed');
    }

    // Update revision
    const completionTime = completed_at || new Date().toISOString();
    await dbHelpers.run(
      'UPDATE revisions SET completed = TRUE, completed_at = ? WHERE revision_id = ?',
      [completionTime, revisionId]
    );

    // Log the action
    await dbHelpers.run(
      'INSERT INTO audit_logs (user_id, action_type, entity, metadata) VALUES (?, ?, ?, ?)',
      [
        req.user.user_id,
        'revision_completed',
        'revision',
        JSON.stringify({ revision_id: revisionId, task_title: revision.title })
      ]
    );

    res.json({
      success: true,
      message: 'Revision marked as completed',
      data: {
        revision_id: revisionId,
        completed_at: completionTime
      }
    });
  })
);

// Reschedule a revision
router.patch('/:revisionId/reschedule',
  [
    body('new_date').isISO8601().withMessage('New date must be a valid date'),
    body('reason').optional().isString().isLength({ max: 500 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { revisionId } = req.params;
    const { new_date, reason } = req.body;

    // Verify revision ownership
    const revision = await dbHelpers.get(
      `SELECT r.revision_id, r.revision_date, r.completed, t.title 
       FROM revisions r
       JOIN tasks t ON r.task_id = t.task_id
       WHERE r.revision_id = ? AND t.user_id = ?`,
      [revisionId, req.user.user_id]
    );

    if (!revision) {
      throw new NotFoundError('Revision not found');
    }

    if (revision.completed) {
      throw new ValidationError('Cannot reschedule a completed revision');
    }

    // Update revision date
    await dbHelpers.run(
      'UPDATE revisions SET revision_date = ? WHERE revision_id = ?',
      [new_date, revisionId]
    );

    // Log the action
    await dbHelpers.run(
      'INSERT INTO audit_logs (user_id, action_type, entity, metadata) VALUES (?, ?, ?, ?)',
      [
        req.user.user_id,
        'revision_rescheduled',
        'revision',
        JSON.stringify({ 
          revision_id: revisionId, 
          old_date: revision.revision_date, 
          new_date, 
          reason 
        })
      ]
    );

    res.json({
      success: true,
      message: 'Revision rescheduled successfully',
      data: {
        revision_id: revisionId,
        old_date: revision.revision_date,
        new_date
      }
    });
  })
);

// Get revision statistics
router.get('/stats',
  asyncHandler(async (req, res) => {
    const userId = req.user.user_id;

    // Get various statistics
    const stats = await dbHelpers.get(
      `SELECT 
        COUNT(*) as total_revisions,
        SUM(CASE WHEN r.completed = TRUE THEN 1 ELSE 0 END) as completed_revisions,
        SUM(CASE WHEN r.completed = FALSE AND r.revision_date < DATE('now') THEN 1 ELSE 0 END) as overdue_revisions,
        SUM(CASE WHEN r.completed = FALSE AND r.revision_date = DATE('now') THEN 1 ELSE 0 END) as today_revisions,
        SUM(CASE WHEN r.completed = FALSE AND r.revision_date BETWEEN DATE('now') AND DATE('now', '+7 days') THEN 1 ELSE 0 END) as upcoming_revisions
      FROM revisions r
      JOIN tasks t ON r.task_id = t.task_id
      WHERE t.user_id = ?`,
      [userId]
    );

    // Get completion rate by revision number
    const completionByNumber = await dbHelpers.all(
      `SELECT 
        r.revision_number,
        COUNT(*) as total,
        SUM(CASE WHEN r.completed = TRUE THEN 1 ELSE 0 END) as completed
      FROM revisions r
      JOIN tasks t ON r.task_id = t.task_id
      WHERE t.user_id = ?
      GROUP BY r.revision_number
      ORDER BY r.revision_number`,
      [userId]
    );

    // Calculate completion rates
    const completionRates = completionByNumber.map(item => ({
      revision_number: item.revision_number,
      total: item.total,
      completed: item.completed,
      rate: item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0
    }));

    res.json({
      success: true,
      data: {
        overview: {
          total: stats.total_revisions || 0,
          completed: stats.completed_revisions || 0,
          overdue: stats.overdue_revisions || 0,
          today: stats.today_revisions || 0,
          upcoming: stats.upcoming_revisions || 0,
          completion_rate: stats.total_revisions > 0 
            ? Math.round((stats.completed_revisions / stats.total_revisions) * 100) 
            : 0
        },
        completion_by_number: completionRates
      }
    });
  })
);

// Upload blank page for revision
router.post('/:revisionId/upload',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const { revisionId } = req.params;
    const file = req.file;

    if (!file) {
      throw new ValidationError('No file uploaded');
    }

    // Verify revision ownership
    const revision = await dbHelpers.get(
      `SELECT r.revision_id, r.completed, r.file_path, t.title, t.description
       FROM revisions r
       JOIN tasks t ON r.task_id = t.task_id
       WHERE r.revision_id = ? AND t.user_id = ?`,
      [revisionId, req.user.user_id]
    );

    if (!revision) {
      throw new NotFoundError('Revision not found');
    }

    if (revision.completed) {
      throw new ValidationError('Cannot upload file for completed revision');
    }

    // If there's an existing file, delete it
    if (revision.file_path && fs.existsSync(revision.file_path)) {
      fs.unlinkSync(revision.file_path);
    }

    // Update revision with file path and metadata
    const fileMetadata = {
      original_name: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      uploaded_at: new Date().toISOString(),
      // Future: AI analysis results will be stored here
      ai_analysis: null,
      comparison_stats: null
    };

    await dbHelpers.run(
      'UPDATE revisions SET file_path = ?, file_metadata = ? WHERE revision_id = ?',
      [file.path, JSON.stringify(fileMetadata), revisionId]
    );

    // Log the action
    await dbHelpers.run(
      'INSERT INTO audit_logs (user_id, action_type, entity, metadata) VALUES (?, ?, ?, ?)',
      [
        req.user.user_id,
        'revision_file_uploaded',
        'revision',
        JSON.stringify({ 
          revision_id: revisionId, 
          task_title: revision.title,
          file_name: file.originalname,
          file_size: file.size,
          file_type: file.mimetype
        })
      ]
    );

    // Future: Trigger AI analysis (commented for future implementation)
    // await triggerAIAnalysis(revisionId, file.path, revision.task_id);

    res.json({
      success: true,
      message: 'Blank page uploaded successfully',
      data: {
        revision_id: revisionId,
        file_name: file.originalname,
        file_path: file.path,
        file_size: file.size,
        file_metadata: fileMetadata
      }
    });
  })
);

// Get file for revision (for viewing/downloading)
router.get('/:revisionId/file',
  asyncHandler(async (req, res) => {
    const { revisionId } = req.params;

    // Verify revision ownership
    const revision = await dbHelpers.get(
      `SELECT r.file_path, r.file_metadata, t.title 
       FROM revisions r
       JOIN tasks t ON r.task_id = t.task_id
       WHERE r.revision_id = ? AND t.user_id = ?`,
      [revisionId, req.user.user_id]
    );

    if (!revision || !revision.file_path) {
      throw new NotFoundError('File not found');
    }

    if (!fs.existsSync(revision.file_path)) {
      throw new NotFoundError('File not found on server');
    }

    const fileMetadata = revision.file_metadata ? JSON.parse(revision.file_metadata) : {};
    
    res.json({
      success: true,
      data: {
        file_path: revision.file_path,
        file_metadata: fileMetadata,
        task_title: revision.title
      }
    });
  })
);

// Delete file for revision
router.delete('/:revisionId/file',
  asyncHandler(async (req, res) => {
    const { revisionId } = req.params;

    // Verify revision ownership
    const revision = await dbHelpers.get(
      `SELECT r.file_path, r.completed, t.title 
       FROM revisions r
       JOIN tasks t ON r.task_id = t.task_id
       WHERE r.revision_id = ? AND t.user_id = ?`,
      [revisionId, req.user.user_id]
    );

    if (!revision) {
      throw new NotFoundError('Revision not found');
    }

    if (!revision.file_path) {
      throw new NotFoundError('No file to delete');
    }

    if (revision.completed) {
      throw new ValidationError('Cannot delete file for completed revision');
    }

    // Delete file from filesystem
    if (fs.existsSync(revision.file_path)) {
      fs.unlinkSync(revision.file_path);
    }

    // Update revision to remove file reference
    await dbHelpers.run(
      'UPDATE revisions SET file_path = NULL, file_metadata = NULL WHERE revision_id = ?',
      [revisionId]
    );

    // Log the action
    await dbHelpers.run(
      'INSERT INTO audit_logs (user_id, action_type, entity, metadata) VALUES (?, ?, ?, ?)',
      [
        req.user.user_id,
        'revision_file_deleted',
        'revision',
        JSON.stringify({ 
          revision_id: revisionId, 
          task_title: revision.title
        })
      ]
    );

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  })
);

export default router; 