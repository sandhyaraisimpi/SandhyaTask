import express from 'express';
import { body, validationResult } from 'express-validator';
import { dbHelpers } from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyToken);

// Get user settings
router.get('/',
  asyncHandler(async (req, res) => {
    const userId = req.user.user_id;

    // Get user settings
    let settings = await dbHelpers.get(
      'SELECT * FROM settings WHERE user_id = ?',
      [userId]
    );

    // If no settings exist, create default settings
    if (!settings) {
      await dbHelpers.run(
        `INSERT INTO settings (
          user_id, 
          theme, 
          reminder_time, 
          whatsapp_enabled, 
          default_intervals
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          'light',
          '09:00:00',
          true,
          '[1,3,7,14]'
        ]
      );

      settings = await dbHelpers.get(
        'SELECT * FROM settings WHERE user_id = ?',
        [userId]
      );
    }

    // Get user profile info
    const user = await dbHelpers.get(
      'SELECT user_id, name, email, google_id, whatsapp_number FROM users WHERE user_id = ?',
      [userId]
    );

    res.json({
      success: true,
      data: {
        settings: {
          theme: settings.theme,
          reminder_time: settings.reminder_time,
          whatsapp_enabled: settings.whatsapp_enabled,
          default_intervals: JSON.parse(settings.default_intervals)
        },
        profile: {
          name: user.name,
          email: user.email,
          whatsapp_number: user.whatsapp_number
        }
      }
    });
  })
);

// Update user settings
router.patch('/',
  [
    body('theme').optional().isIn(['light', 'dark']),
    body('reminder_time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/),
    body('whatsapp_enabled').optional().isBoolean(),
    body('default_intervals').optional().isArray().custom((value) => {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error('Default intervals must be a non-empty array');
      }
      if (!value.every(n => Number.isInteger(n) && n > 0)) {
        throw new Error('All intervals must be positive integers');
      }
      return true;
    })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const userId = req.user.user_id;
    const { theme, reminder_time, whatsapp_enabled, default_intervals } = req.body;

    // Check if settings exist
    const existingSettings = await dbHelpers.get(
      'SELECT setting_id FROM settings WHERE user_id = ?',
      [userId]
    );

    if (existingSettings) {
      // Update existing settings
      const updateFields = [];
      const updateValues = [];

      if (theme !== undefined) {
        updateFields.push('theme = ?');
        updateValues.push(theme);
      }

      if (reminder_time !== undefined) {
        updateFields.push('reminder_time = ?');
        updateValues.push(reminder_time);
      }

      if (whatsapp_enabled !== undefined) {
        updateFields.push('whatsapp_enabled = ?');
        updateValues.push(whatsapp_enabled);
      }

      if (default_intervals !== undefined) {
        updateFields.push('default_intervals = ?');
        updateValues.push(JSON.stringify(default_intervals));
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = ?');
        updateValues.push(new Date().toISOString());
        updateValues.push(userId);

        await dbHelpers.run(
          `UPDATE settings SET ${updateFields.join(', ')} WHERE user_id = ?`,
          updateValues
        );
      }
    } else {
      // Create new settings
      await dbHelpers.run(
        `INSERT INTO settings (
          user_id, 
          theme, 
          reminder_time, 
          whatsapp_enabled, 
          default_intervals
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          theme || 'light',
          reminder_time || '09:00:00',
          whatsapp_enabled !== undefined ? whatsapp_enabled : true,
          default_intervals ? JSON.stringify(default_intervals) : '[1,3,7,14]'
        ]
      );
    }

    // Log the action
    await dbHelpers.run(
      'INSERT INTO audit_logs (user_id, action_type, entity, metadata) VALUES (?, ?, ?, ?)',
      [
        userId,
        'settings_updated',
        'settings',
        JSON.stringify({ theme, reminder_time, whatsapp_enabled, default_intervals })
      ]
    );

    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  })
);

// Update user profile
router.patch('/profile',
  [
    body('name').optional().isString().isLength({ min: 1, max: 100 }),
    body('whatsapp_number').optional().isString().isLength({ min: 10, max: 15 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const userId = req.user.user_id;
    const { name, whatsapp_number } = req.body;

    // Check if WhatsApp number is already in use by another user
    if (whatsapp_number) {
      const existingUser = await dbHelpers.get(
        'SELECT user_id FROM users WHERE whatsapp_number = ? AND user_id != ?',
        [whatsapp_number, userId]
      );

      if (existingUser) {
        throw new ValidationError('WhatsApp number is already registered by another user');
      }
    }

    // Update user profile
    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }

    if (whatsapp_number !== undefined) {
      updateFields.push('whatsapp_number = ?');
      updateValues.push(whatsapp_number);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = ?');
      updateValues.push(new Date().toISOString());
      updateValues.push(userId);

      await dbHelpers.run(
        `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = ?`,
        updateValues
      );
    }

    // Log the action
    await dbHelpers.run(
      'INSERT INTO audit_logs (user_id, action_type, entity, metadata) VALUES (?, ?, ?, ?)',
      [
        userId,
        'profile_updated',
        'user',
        JSON.stringify({ name, whatsapp_number })
      ]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  })
);

// Get available themes
router.get('/themes',
  asyncHandler(async (req, res) => {
    const themes = [
      {
        id: 'light',
        name: 'Light Theme',
        description: 'Clean and bright interface'
      },
      {
        id: 'dark',
        name: 'Dark Theme',
        description: 'Easy on the eyes in low light'
      }
    ];

    res.json({
      success: true,
      data: themes
    });
  })
);

// Get default interval presets
router.get('/interval-presets',
  asyncHandler(async (req, res) => {
    const presets = [
      {
        id: 'fast',
        name: 'Fast Learning',
        description: 'Quick revision for urgent topics',
        intervals: [1, 2, 4, 7]
      },
      {
        id: 'standard',
        name: 'Standard',
        description: 'Balanced learning pace',
        intervals: [1, 3, 7, 14]
      },
      {
        id: 'thorough',
        name: 'Thorough',
        description: 'Deep learning with longer intervals',
        intervals: [1, 7, 14, 30]
      },
      {
        id: 'custom',
        name: 'Custom',
        description: 'Define your own intervals',
        intervals: []
      }
    ];

    res.json({
      success: true,
      data: presets
    });
  })
);

// Get notification preferences
router.get('/notifications',
  asyncHandler(async (req, res) => {
    const userId = req.user.user_id;

    const settings = await dbHelpers.get(
      'SELECT reminder_time, whatsapp_enabled FROM settings WHERE user_id = ?',
      [userId]
    );

    const preferences = {
      daily_reminder: {
        enabled: true,
        time: settings?.reminder_time || '09:00:00',
        description: 'Daily PDF summary of tasks and revisions'
      },
      whatsapp_integration: {
        enabled: settings?.whatsapp_enabled || false,
        description: 'Receive notifications and manage tasks via WhatsApp'
      },
      task_reminders: {
        enabled: true,
        description: 'Reminders for upcoming tasks and revisions'
      },
      completion_notifications: {
        enabled: true,
        description: 'Notifications when tasks or revisions are completed'
      }
    };

    res.json({
      success: true,
      data: preferences
    });
  })
);

// Update notification preferences
router.patch('/notifications',
  [
    body('daily_reminder.enabled').optional().isBoolean(),
    body('daily_reminder.time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/),
    body('whatsapp_integration.enabled').optional().isBoolean(),
    body('task_reminders.enabled').optional().isBoolean(),
    body('completion_notifications.enabled').optional().isBoolean()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const userId = req.user.user_id;
    const { daily_reminder, whatsapp_integration } = req.body;

    // Update settings based on notification preferences
    const updateFields = [];
    const updateValues = [];

    if (daily_reminder?.time !== undefined) {
      updateFields.push('reminder_time = ?');
      updateValues.push(daily_reminder.time);
    }

    if (whatsapp_integration?.enabled !== undefined) {
      updateFields.push('whatsapp_enabled = ?');
      updateValues.push(whatsapp_integration.enabled);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = ?');
      updateValues.push(new Date().toISOString());
      updateValues.push(userId);

      await dbHelpers.run(
        `UPDATE settings SET ${updateFields.join(', ')} WHERE user_id = ?`,
        updateValues
      );
    }

    // Log the action
    await dbHelpers.run(
      'INSERT INTO audit_logs (user_id, action_type, entity, metadata) VALUES (?, ?, ?, ?)',
      [
        userId,
        'notification_preferences_updated',
        'settings',
        JSON.stringify(req.body)
      ]
    );

    res.json({
      success: true,
      message: 'Notification preferences updated successfully'
    });
  })
);

// Get data export options
router.get('/export-options',
  asyncHandler(async (req, res) => {
    const exportOptions = [
      {
        id: 'tasks',
        name: 'Tasks',
        description: 'Export all your tasks and their status',
        format: 'json'
      },
      {
        id: 'revisions',
        name: 'Revisions',
        description: 'Export revision history and completion data',
        format: 'json'
      },
      {
        id: 'settings',
        name: 'Settings',
        description: 'Export your app settings and preferences',
        format: 'json'
      },
      {
        id: 'audit_logs',
        name: 'Activity Logs',
        description: 'Export your activity history',
        format: 'json'
      }
    ];

    res.json({
      success: true,
      data: exportOptions
    });
  })
);

// Export user data
router.post('/export',
  [
    body('data_types').isArray().custom((value) => {
      const validTypes = ['tasks', 'revisions', 'settings', 'audit_logs'];
      return value.every(type => validTypes.includes(type));
    })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const userId = req.user.user_id;
    const { data_types } = req.body;

    const exportData = {
      export_date: new Date().toISOString(),
      user_id: userId,
      data: {}
    };

    // Export requested data types
    for (const dataType of data_types) {
      switch (dataType) {
        case 'tasks':
          exportData.data.tasks = await dbHelpers.all(
            'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
          );
          break;

        case 'revisions':
          exportData.data.revisions = await dbHelpers.all(
            'SELECT r.*, t.title as task_title FROM revisions r JOIN tasks t ON r.task_id = t.task_id WHERE r.user_id = ? ORDER BY r.created_at DESC',
            [userId]
          );
          break;

        case 'settings':
          exportData.data.settings = await dbHelpers.get(
            'SELECT * FROM settings WHERE user_id = ?',
            [userId]
          );
          break;

        case 'audit_logs':
          exportData.data.audit_logs = await dbHelpers.all(
            'SELECT * FROM audit_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1000',
            [userId]
          );
          break;
      }
    }

    // Log the export action
    await dbHelpers.run(
      'INSERT INTO audit_logs (user_id, action_type, entity, metadata) VALUES (?, ?, ?, ?)',
      [
        userId,
        'data_exported',
        'user_data',
        JSON.stringify({ data_types, export_date: exportData.export_date })
      ]
    );

    res.json({
      success: true,
      data: exportData
    });
  })
);

// Delete user account
router.delete('/account',
  [
    body('confirmation').equals('DELETE_MY_ACCOUNT').withMessage('Confirmation text must be exactly "DELETE_MY_ACCOUNT"')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const userId = req.user.user_id;

    // Begin transaction
    await dbHelpers.beginTransaction();

    try {
      // Delete user data in order (respecting foreign key constraints)
      await dbHelpers.run('DELETE FROM audit_logs WHERE user_id = ?', [userId]);
      await dbHelpers.run('DELETE FROM whatsapp_logs WHERE user_id = ?', [userId]);
      await dbHelpers.run('DELETE FROM feedback WHERE user_id = ?', [userId]);
      await dbHelpers.run('DELETE FROM settings WHERE user_id = ?', [userId]);
      await dbHelpers.run('DELETE FROM revisions WHERE user_id = ?', [userId]);
      await dbHelpers.run('DELETE FROM tasks WHERE user_id = ?', [userId]);
      await dbHelpers.run('DELETE FROM users WHERE user_id = ?', [userId]);

      // Commit transaction
      await dbHelpers.commitTransaction();

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });

    } catch (error) {
      // Rollback transaction on error
      await dbHelpers.rollbackTransaction();
      throw error;
    }
  })
);

export default router; 