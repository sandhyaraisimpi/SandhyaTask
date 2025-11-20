import express from 'express';
import { body, validationResult } from 'express-validator';
import { dbHelpers } from '../config/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import moment from 'moment';

const router = express.Router();

// WhatsApp webhook endpoint (no auth required for incoming messages)
router.post('/webhook',
  [
    body('From').isString(),
    body('Body').isString(),
    body('MessageSid').isString()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { From, Body, MessageSid } = req.body;
    const phoneNumber = From.replace('whatsapp:', '');
    const message = Body.trim();

    // Log the incoming message
    await dbHelpers.run(
      'INSERT INTO whatsapp_logs (message, command_type, received_at) VALUES (?, ?, ?)',
      [message, 'incoming', new Date().toISOString()]
    );

    try {
      // Find user by WhatsApp number
      const user = await dbHelpers.get(
        'SELECT user_id, name FROM users WHERE whatsapp_number = ?',
        [phoneNumber]
      );

      if (!user) {
        // Send error message for unregistered number
        await sendWhatsAppResponse(phoneNumber, 
          '❌ This number is not registered with SumiTask. Please log in to the app first to link your WhatsApp number.');
        return res.status(200).json({ success: true, message: 'Unregistered number' });
      }

      // Process the command
      const response = await processWhatsAppCommand(message, user.user_id);
      
      // Send response
      await sendWhatsAppResponse(phoneNumber, response);

      // Log the processed command
      await dbHelpers.run(
        'UPDATE whatsapp_logs SET processed = TRUE WHERE MessageSid = ?',
        [MessageSid]
      );

      res.status(200).json({ success: true, message: 'Command processed' });

    } catch (error) {
      console.error('WhatsApp webhook error:', error);
      
      // Send error message to user
      await sendWhatsAppResponse(phoneNumber, 
        '❌ Sorry, there was an error processing your command. Please try again or contact support.');
      
      res.status(500).json({ success: false, error: error.message });
    }
  })
);

// Process WhatsApp commands
async function processWhatsAppCommand(message, userId) {
  const command = message.toLowerCase().trim();
  
  // Add task command
  if (command.startsWith('add:')) {
    return await handleAddTask(message, userId);
  }
  
  // Mark task as done
  if (command.startsWith('done:')) {
    return await handleMarkDone(message, userId);
  }
  
  // List tasks
  if (command.startsWith('list')) {
    return await handleListTasks(message, userId);
  }
  
  // Get report
  if (command === 'report') {
    return await handleGetReport(userId);
  }
  
  // Show missed tasks
  if (command === 'missed') {
    return await handleMissedTasks(userId);
  }
  
  // Show help
  if (command === 'help') {
    return getHelpMessage();
  }
  
  // Default response
  return `❓ Unknown command. Type "help" to see available commands.`;
}

// Handle add task command
async function handleAddTask(message, userId) {
  const taskText = message.substring(4).trim(); // Remove "add:"
  
  if (!taskText) {
    return '❌ Please provide a task description. Example: "Add: Submit essay by 5pm"';
  }

  try {
    // Parse task text for date/time
    const parsed = parseTaskText(taskText);
    
    // Insert task
    const result = await dbHelpers.run(
      `INSERT INTO tasks (user_id, title, description, due_date, time, priority, tag, is_revision_task, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        parsed.title,
        parsed.description || null,
        parsed.dueDate,
        parsed.time || null,
        parsed.priority || 'MEDIUM',
        parsed.tag || null,
        parsed.isRevision || false,
        'pending'
      ]
    );

    // If it's a revision task, create revision schedule
    if (parsed.isRevision && parsed.spacedPattern) {
      await createRevisionSchedule(result.lastID, parsed.spacedPattern, parsed.dueDate);
    }

    // Log the action
    await dbHelpers.run(
      'INSERT INTO audit_logs (user_id, action_type, entity, metadata) VALUES (?, ?, ?, ?)',
      [
        userId,
        'task_added_via_whatsapp',
        'task',
        JSON.stringify({ task_id: result.lastID, title: parsed.title })
      ]
    );

    return `✅ Task added: "${parsed.title}" for ${parsed.dueDate}${parsed.time ? ` at ${parsed.time}` : ''}`;

  } catch (error) {
    console.error('Error adding task:', error);
    return '❌ Failed to add task. Please try again.';
  }
}

// Handle mark done command
async function handleMarkDone(message, userId) {
  const taskText = message.substring(5).trim(); // Remove "done:"
  
  if (!taskText) {
    return '❌ Please specify which task to mark as done. Example: "Done: Submit essay"';
  }

  try {
    // Find task by title
    const task = await dbHelpers.get(
      'SELECT task_id, title, status FROM tasks WHERE user_id = ? AND title LIKE ? AND status != "completed" ORDER BY due_date DESC LIMIT 1',
      [userId, `%${taskText}%`]
    );

    if (!task) {
      return '❌ Task not found or already completed.';
    }

    // Mark as completed
    await dbHelpers.run(
      'UPDATE tasks SET status = "completed", updated_at = ? WHERE task_id = ?',
      [new Date().toISOString(), task.task_id]
    );

    // Log the action
    await dbHelpers.run(
      'INSERT INTO audit_logs (user_id, action_type, entity, metadata) VALUES (?, ?, ?, ?)',
      [
        userId,
        'task_completed_via_whatsapp',
        'task',
        JSON.stringify({ task_id: task.task_id, title: task.title })
      ]
    );

    return `✅ Marked as done: "${task.title}"`;

  } catch (error) {
    console.error('Error marking task done:', error);
    return '❌ Failed to mark task as done. Please try again.';
  }
}

// Handle list tasks command
async function handleListTasks(message, userId) {
  const parts = message.split(' ');
  let dateFilter = 'today';
  let statusFilter = 'all';

  // Parse filters
  if (parts.length > 1) {
    const filter = parts[1].toLowerCase();
    
    if (filter === 'tomorrow') {
      dateFilter = 'tomorrow';
    } else if (filter === 'completed') {
      statusFilter = 'completed';
    } else if (filter === 'missed') {
      statusFilter = 'missed';
    } else if (filter.match(/^\d{4}-\d{2}-\d{2}$/)) {
      dateFilter = filter;
    }
  }

  try {
    let query = `
      SELECT title, due_date, time, priority, status, is_revision_task
      FROM tasks 
      WHERE user_id = ?
    `;
    let params = [userId];

    // Add date filter
    if (dateFilter === 'today') {
      query += ' AND due_date = DATE("now")';
    } else if (dateFilter === 'tomorrow') {
      query += ' AND due_date = DATE("now", "+1 day")';
    } else {
      query += ' AND due_date = ?';
      params.push(dateFilter);
    }

    // Add status filter
    if (statusFilter === 'completed') {
      query += ' AND status = "completed"';
    } else if (statusFilter === 'missed') {
      query += ' AND status != "completed" AND due_date < DATE("now")';
    }

    query += ' ORDER BY due_date ASC, time ASC';

    const tasks = await dbHelpers.all(query, params);

    if (tasks.length === 0) {
      return `📋 No tasks found for ${dateFilter === 'today' ? 'today' : dateFilter === 'tomorrow' ? 'tomorrow' : dateFilter}`;
    }

    let response = `📋 Tasks for ${dateFilter === 'today' ? 'today' : dateFilter === 'tomorrow' ? 'tomorrow' : dateFilter}:\n\n`;
    
    tasks.forEach((task, index) => {
      const statusIcon = task.status === 'completed' ? '✅' : '⏳';
      const priorityIcon = task.priority === 'HIGH' ? '🔴' : task.priority === 'MEDIUM' ? '🟡' : '🟢';
      const revisionIcon = task.is_revision_task ? '🔁' : '📌';
      const timeText = task.time ? ` at ${task.time}` : '';
      
      response += `${index + 1}. ${statusIcon} ${revisionIcon} ${task.title}${timeText} ${priorityIcon}\n`;
    });

    return response;

  } catch (error) {
    console.error('Error listing tasks:', error);
    return '❌ Failed to list tasks. Please try again.';
  }
}

// Handle get report command
async function handleGetReport(userId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's tasks
    const tasks = await dbHelpers.all(
      'SELECT title, status, is_revision_task FROM tasks WHERE user_id = ? AND due_date = ?',
      [userId, today]
    );

    // Get today's revisions
    const revisions = await dbHelpers.all(
      `SELECT r.completed, t.title 
       FROM revisions r
       JOIN tasks t ON r.task_id = t.task_id
       WHERE r.user_id = ? AND r.revision_date = ?`,
      [userId, today]
    );

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalRevisions = revisions.length;
    const completedRevisions = revisions.filter(r => r.completed).length;

    let response = `📊 Daily Report - ${moment(today).format('dddd, MMMM Do')}\n\n`;
    response += `📋 Tasks: ${completedTasks}/${totalTasks} completed\n`;
    response += `🔁 Revisions: ${completedRevisions}/${totalRevisions} completed\n\n`;

    if (totalTasks > 0) {
      response += '📋 Today\'s Tasks:\n';
      tasks.forEach((task, index) => {
        const statusIcon = task.status === 'completed' ? '✅' : '⏳';
        const typeIcon = task.is_revision_task ? '🔁' : '📌';
        response += `${index + 1}. ${statusIcon} ${typeIcon} ${task.title}\n`;
      });
    }

    if (totalRevisions > 0) {
      response += '\n🔁 Today\'s Revisions:\n';
      revisions.forEach((revision, index) => {
        const statusIcon = revision.completed ? '✅' : '⏳';
        response += `${index + 1}. ${statusIcon} ${revision.title}\n`;
      });
    }

    return response;

  } catch (error) {
    console.error('Error generating report:', error);
    return '❌ Failed to generate report. Please try again.';
  }
}

// Handle missed tasks command
async function handleMissedTasks(userId) {
  try {
    const tasks = await dbHelpers.all(
      'SELECT title, due_date, priority FROM tasks WHERE user_id = ? AND status != "completed" AND due_date < DATE("now") ORDER BY due_date ASC',
      [userId]
    );

    if (tasks.length === 0) {
      return '✅ No missed tasks! You\'re all caught up.';
    }

    let response = `⚠️ Missed Tasks (${tasks.length}):\n\n`;
    
    tasks.forEach((task, index) => {
      const priorityIcon = task.priority === 'HIGH' ? '🔴' : task.priority === 'MEDIUM' ? '🟡' : '🟢';
      const daysLate = moment().diff(moment(task.due_date), 'days');
      const lateText = daysLate === 1 ? '1 day late' : `${daysLate} days late`;
      
      response += `${index + 1}. ${task.title} (${lateText}) ${priorityIcon}\n`;
    });

    return response;

  } catch (error) {
    console.error('Error getting missed tasks:', error);
    return '❌ Failed to get missed tasks. Please try again.';
  }
}

// Get help message
function getHelpMessage() {
  return `📱 SumiTask WhatsApp Commands:

📝 Add Tasks:
• Add: Submit essay by 5pm
• Add: Revise Chapter 3 (spaced 1,3,7)
• Add: Finish project on 2024-01-15 at 2pm

✅ Mark Complete:
• Done: Submit essay
• Done: Revise Chapter 3

📋 List Tasks:
• List (today's tasks)
• List tomorrow
• List 2024-01-15
• List completed
• List missed

📊 Reports:
• Report (daily summary)
• Missed (overdue tasks)

❓ Help:
• Help (this message)

💡 Tips:
• Use "spaced" for revision tasks
• Include dates in YYYY-MM-DD format
• Times in 24-hour format (14:30)`;
}

// Parse task text for date, time, and other details
function parseTaskText(text) {
  const result = {
    title: text,
    description: null,
    dueDate: new Date().toISOString().split('T')[0], // Default to today
    time: null,
    priority: 'MEDIUM',
    tag: null,
    isRevision: false,
    spacedPattern: null
  };

  // Check for revision task
  if (text.toLowerCase().includes('(spaced')) {
    result.isRevision = true;
    const spacedMatch = text.match(/\(spaced\s+([^)]+)\)/i);
    if (spacedMatch) {
      result.spacedPattern = spacedMatch[1].split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
      result.title = text.replace(/\(spaced\s+[^)]+\)/i, '').trim();
    }
  }

  // Check for date patterns
  const datePatterns = [
    /on\s+(\d{4}-\d{2}-\d{2})/i,
    /on\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
    /tomorrow/i,
    /today/i
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[1]) {
        if (match[1].includes('/')) {
          // Convert MM/DD/YYYY to YYYY-MM-DD
          const parts = match[1].split('/');
          result.dueDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        } else {
          result.dueDate = match[1];
        }
      } else if (pattern.source.includes('tomorrow')) {
        result.dueDate = moment().add(1, 'day').format('YYYY-MM-DD');
      } else if (pattern.source.includes('today')) {
        result.dueDate = moment().format('YYYY-MM-DD');
      }
      result.title = text.replace(pattern, '').trim();
      break;
    }
  }

  // Check for time patterns
  const timePatterns = [
    /at\s+(\d{1,2}:\d{2})/i,
    /by\s+(\d{1,2}:\d{2})/i,
    /(\d{1,2}:\d{2})/,
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i
  ];

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      let time = match[1];
      
      // Convert 12-hour to 24-hour format
      if (time.match(/\d{1,2}(?::\d{2})?\s*(?:am|pm)/i)) {
        const timeMatch = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
        let hour = parseInt(timeMatch[1]);
        const minute = timeMatch[2] || '00';
        const period = timeMatch[3].toLowerCase();
        
        if (period === 'pm' && hour !== 12) hour += 12;
        if (period === 'am' && hour === 12) hour = 0;
        
        time = `${hour.toString().padStart(2, '0')}:${minute}`;
      }
      
      result.time = time;
      result.title = text.replace(pattern, '').trim();
      break;
    }
  }

  // Check for priority indicators
  if (text.toLowerCase().includes('urgent') || text.toLowerCase().includes('asap')) {
    result.priority = 'HIGH';
  } else if (text.toLowerCase().includes('low priority')) {
    result.priority = 'LOW';
  }

  // Clean up title
  result.title = result.title
    .replace(/\s+/g, ' ')
    .trim();

  return result;
}

// Create revision schedule
async function createRevisionSchedule(taskId, pattern, startDate) {
  try {
    for (let i = 0; i < pattern.length; i++) {
      const revisionDate = moment(startDate).add(pattern[i], 'days').format('YYYY-MM-DD');
      
      await dbHelpers.run(
        'INSERT INTO revisions (task_id, user_id, revision_date, revision_number) VALUES (?, ?, ?, ?)',
        [taskId, userId, revisionDate, i + 1]
      );
    }
  } catch (error) {
    console.error('Error creating revision schedule:', error);
  }
}

// Send WhatsApp response (placeholder - implement with actual WhatsApp API)
async function sendWhatsAppResponse(phoneNumber, message) {
  // This is a placeholder. In a real implementation, you would:
  // 1. Use Twilio WhatsApp API
  // 2. Or use Meta WhatsApp Business API
  // 3. Send the message to the user's WhatsApp number
  
  console.log(`WhatsApp response to ${phoneNumber}: ${message}`);
  
  // For now, just log the response
  // In production, implement actual WhatsApp sending logic here
}

export default router; 