import express from 'express';
import { query, validationResult } from 'express-validator';
import { dbHelpers } from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ValidationError } from '../middleware/errorHandler.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import moment from 'moment';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyToken);

// Generate PDF for today's tasks
router.get('/today',
  asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const today = new Date().toISOString().split('T')[0];

    // Get today's tasks
    const tasks = await dbHelpers.all(
      `SELECT 
        title,
        description,
        time,
        priority,
        tag,
        is_revision_task,
        status
      FROM tasks 
      WHERE user_id = ? AND due_date = ?
      ORDER BY time ASC, priority DESC`,
      [userId, today]
    );

    // Get today's revisions
    const revisions = await dbHelpers.all(
      `SELECT 
        r.revision_number,
        t.title as task_title,
        t.description as task_description,
        t.priority,
        t.tag,
        r.completed
      FROM revisions r
      JOIN tasks t ON r.task_id = t.task_id
      WHERE r.user_id = ? AND r.revision_date = ?
      ORDER BY r.revision_number ASC`,
      [userId, today]
    );

    // Create PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sumitask-${today}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add header
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .text('SumiTask - Daily Schedule', { align: 'center' })
       .moveDown();

    doc.fontSize(16)
       .font('Helvetica')
       .text(`Date: ${moment(today).format('dddd, MMMM Do YYYY')}`, { align: 'center' })
       .moveDown(2);

    // Add tasks section
    if (tasks.length > 0) {
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .text('📋 Today\'s Tasks')
         .moveDown();

      tasks.forEach((task, index) => {
        const priorityColor = task.priority === 'HIGH' ? '#dc2626' : 
                            task.priority === 'MEDIUM' ? '#f59e0b' : '#10b981';
        
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor(priorityColor)
           .text(`${index + 1}. ${task.title}`)
           .fillColor('#000000');

        if (task.description) {
          doc.fontSize(12)
             .font('Helvetica')
             .text(`   ${task.description}`)
             .moveDown(0.5);
        }

        const timeText = task.time ? `Time: ${task.time}` : '';
        const priorityText = `Priority: ${task.priority}`;
        const tagText = task.tag ? `Tag: ${task.tag}` : '';
        const statusText = `Status: ${task.status}`;

        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#666666')
           .text(`   ${[timeText, priorityText, tagText, statusText].filter(Boolean).join(' | ')}`)
           .fillColor('#000000')
           .moveDown();
      });
    }

    // Add revisions section
    if (revisions.length > 0) {
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .text('🔁 Today\'s Revisions')
         .moveDown();

      revisions.forEach((revision, index) => {
        const statusIcon = revision.completed ? '✅' : '⏳';
        
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text(`${index + 1}. ${statusIcon} Day ${revision.revision_number}: ${revision.task_title}`)
           .moveDown(0.5);

        if (revision.task_description) {
          doc.fontSize(12)
             .font('Helvetica')
             .text(`   ${revision.task_description}`)
             .moveDown(0.5);
        }

        const priorityText = `Priority: ${revision.priority}`;
        const tagText = revision.tag ? `Tag: ${revision.tag}` : '';
        const statusText = revision.completed ? 'Completed' : 'Pending';

        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#666666')
           .text(`   ${[priorityText, tagText, statusText].filter(Boolean).join(' | ')}`)
           .fillColor('#000000')
           .moveDown();
      });
    }

    // Add summary
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalRevisions = revisions.length;
    const completedRevisions = revisions.filter(r => r.completed).length;

    doc.moveDown(2)
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('📊 Summary')
       .moveDown();

    doc.fontSize(12)
       .font('Helvetica')
       .text(`Tasks: ${completedTasks}/${totalTasks} completed`)
       .text(`Revisions: ${completedRevisions}/${totalRevisions} completed`)
       .moveDown();

    // Add motivational quote
    const quotes = [
      "The only way to do great work is to love what you do. - Steve Jobs",
      "Success is not final, failure is not fatal: it is the courage to continue that counts. - Winston Churchill",
      "The future depends on what you do today. - Mahatma Gandhi",
      "Don't watch the clock; do what it does. Keep going. - Sam Levenson",
      "The only limit to our realization of tomorrow will be our doubts of today. - Franklin D. Roosevelt"
    ];

    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

    doc.fontSize(12)
       .font('Helvetica-Oblique')
       .fillColor('#666666')
       .text(`"${randomQuote}"`, { align: 'center' })
       .fillColor('#000000')
       .moveDown(2);

    // Add footer
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#999999')
       .text('Generated by SumiTask - Plan, revise, and achieve — the Suman way.', { align: 'center' });

    // Finalize PDF
    doc.end();
  })
);

// Generate PDF for specific date
router.get('/date/:date',
  [
    query('include_completed').optional().isBoolean()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { date } = req.params;
    const { include_completed = false } = req.query;
    const userId = req.user.user_id;

    // Validate date format
    if (!moment(date, 'YYYY-MM-DD', true).isValid()) {
      throw new ValidationError('Invalid date format. Use YYYY-MM-DD');
    }

    // Get tasks for the date
    let tasksQuery = `
      SELECT 
        title,
        description,
        time,
        priority,
        tag,
        is_revision_task,
        status
      FROM tasks 
      WHERE user_id = ? AND due_date = ?
    `;
    
    if (!include_completed) {
      tasksQuery += ' AND status != "completed"';
    }
    
    tasksQuery += ' ORDER BY time ASC, priority DESC';

    const tasks = await dbHelpers.all(tasksQuery, [userId, date]);

    // Get revisions for the date
    const revisions = await dbHelpers.all(
      `SELECT 
        r.revision_number,
        t.title as task_title,
        t.description as task_description,
        t.priority,
        t.tag,
        r.completed
      FROM revisions r
      JOIN tasks t ON r.task_id = t.task_id
      WHERE r.user_id = ? AND r.revision_date = ?
      ORDER BY r.revision_number ASC`,
      [userId, date]
    );

    // Create PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sumitask-${date}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add header
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .text('SumiTask - Schedule', { align: 'center' })
       .moveDown();

    doc.fontSize(16)
       .font('Helvetica')
       .text(`Date: ${moment(date).format('dddd, MMMM Do YYYY')}`, { align: 'center' })
       .moveDown(2);

    // Add tasks section
    if (tasks.length > 0) {
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .text('📋 Tasks')
         .moveDown();

      tasks.forEach((task, index) => {
        const priorityColor = task.priority === 'HIGH' ? '#dc2626' : 
                            task.priority === 'MEDIUM' ? '#f59e0b' : '#10b981';
        
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor(priorityColor)
           .text(`${index + 1}. ${task.title}`)
           .fillColor('#000000');

        if (task.description) {
          doc.fontSize(12)
             .font('Helvetica')
             .text(`   ${task.description}`)
             .moveDown(0.5);
        }

        const timeText = task.time ? `Time: ${task.time}` : '';
        const priorityText = `Priority: ${task.priority}`;
        const tagText = task.tag ? `Tag: ${task.tag}` : '';
        const statusText = `Status: ${task.status}`;

        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#666666')
           .text(`   ${[timeText, priorityText, tagText, statusText].filter(Boolean).join(' | ')}`)
           .fillColor('#000000')
           .moveDown();
      });
    }

    // Add revisions section
    if (revisions.length > 0) {
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .text('🔁 Revisions')
         .moveDown();

      revisions.forEach((revision, index) => {
        const statusIcon = revision.completed ? '✅' : '⏳';
        
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text(`${index + 1}. ${statusIcon} Day ${revision.revision_number}: ${revision.task_title}`)
           .moveDown(0.5);

        if (revision.task_description) {
          doc.fontSize(12)
             .font('Helvetica')
             .text(`   ${revision.task_description}`)
             .moveDown(0.5);
        }

        const priorityText = `Priority: ${revision.priority}`;
        const tagText = revision.tag ? `Tag: ${revision.tag}` : '';
        const statusText = revision.completed ? 'Completed' : 'Pending';

        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#666666')
           .text(`   ${[priorityText, tagText, statusText].filter(Boolean).join(' | ')}`)
           .fillColor('#000000')
           .moveDown();
      });
    }

    // Add summary
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalRevisions = revisions.length;
    const completedRevisions = revisions.filter(r => r.completed).length;

    doc.moveDown(2)
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('📊 Summary')
       .moveDown();

    doc.fontSize(12)
       .font('Helvetica')
       .text(`Tasks: ${completedTasks}/${totalTasks} completed`)
       .text(`Revisions: ${completedRevisions}/${totalRevisions} completed`)
       .moveDown();

    // Add footer
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#999999')
       .text('Generated by SumiTask - Plan, revise, and achieve — the Suman way.', { align: 'center' });

    // Finalize PDF
    doc.end();
  })
);

// Generate weekly report PDF
router.get('/weekly',
  [
    query('start_date').optional().isISO8601()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const userId = req.user.user_id;
    const startDate = req.query.start_date || moment().startOf('week').format('YYYY-MM-DD');
    const endDate = moment(startDate).add(6, 'days').format('YYYY-MM-DD');

    // Get tasks for the week
    const tasks = await dbHelpers.all(
      `SELECT 
        title,
        description,
        due_date,
        time,
        priority,
        tag,
        is_revision_task,
        status
      FROM tasks 
      WHERE user_id = ? AND due_date BETWEEN ? AND ?
      ORDER BY due_date ASC, time ASC`,
      [userId, startDate, endDate]
    );

    // Get revisions for the week
    const revisions = await dbHelpers.all(
      `SELECT 
        r.revision_date,
        r.revision_number,
        t.title as task_title,
        t.description as task_description,
        t.priority,
        t.tag,
        r.completed
      FROM revisions r
      JOIN tasks t ON r.task_id = t.task_id
      WHERE r.user_id = ? AND r.revision_date BETWEEN ? AND ?
      ORDER BY r.revision_date ASC, r.revision_number ASC`,
      [userId, startDate, endDate]
    );

    // Create PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sumitask-weekly-${startDate}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add header
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .text('SumiTask - Weekly Report', { align: 'center' })
       .moveDown();

    doc.fontSize(16)
       .font('Helvetica')
       .text(`Week of ${moment(startDate).format('MMMM Do YYYY')}`, { align: 'center' })
       .moveDown(2);

    // Group tasks by date
    const tasksByDate = tasks.reduce((acc, task) => {
      const date = task.due_date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(task);
      return acc;
    }, {});

    // Group revisions by date
    const revisionsByDate = revisions.reduce((acc, revision) => {
      const date = revision.revision_date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(revision);
      return acc;
    }, {});

    // Generate daily sections
    for (let i = 0; i < 7; i++) {
      const currentDate = moment(startDate).add(i, 'days').format('YYYY-MM-DD');
      const dayName = moment(currentDate).format('dddd');
      const dateFormatted = moment(currentDate).format('MMMM Do');

      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text(`${dayName}, ${dateFormatted}`)
         .moveDown();

      const dayTasks = tasksByDate[currentDate] || [];
      const dayRevisions = revisionsByDate[currentDate] || [];

      // Add tasks for the day
      if (dayTasks.length > 0) {
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('📋 Tasks')
           .moveDown();

        dayTasks.forEach((task, index) => {
          const statusIcon = task.status === 'completed' ? '✅' : '⏳';
          const priorityColor = task.priority === 'HIGH' ? '#dc2626' : 
                              task.priority === 'MEDIUM' ? '#f59e0b' : '#10b981';
          
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor(priorityColor)
             .text(`${index + 1}. ${statusIcon} ${task.title}`)
             .fillColor('#000000');

          if (task.time) {
            doc.fontSize(10)
               .font('Helvetica')
               .fillColor('#666666')
               .text(`   Time: ${task.time} | Priority: ${task.priority}`)
               .fillColor('#000000');
          }
          doc.moveDown(0.5);
        });
      }

      // Add revisions for the day
      if (dayRevisions.length > 0) {
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('🔁 Revisions')
           .moveDown();

        dayRevisions.forEach((revision, index) => {
          const statusIcon = revision.completed ? '✅' : '⏳';
          
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .text(`${index + 1}. ${statusIcon} Day ${revision.revision_number}: ${revision.task_title}`)
             .moveDown(0.5);
        });
      }

      if (dayTasks.length === 0 && dayRevisions.length === 0) {
        doc.fontSize(12)
           .font('Helvetica')
           .fillColor('#999999')
           .text('No tasks or revisions scheduled')
           .fillColor('#000000');
      }

      doc.moveDown(2);
    }

    // Add weekly summary
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalRevisions = revisions.length;
    const completedRevisions = revisions.filter(r => r.completed).length;

    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('📊 Weekly Summary')
       .moveDown();

    doc.fontSize(12)
       .font('Helvetica')
       .text(`Total Tasks: ${totalTasks}`)
       .text(`Completed Tasks: ${completedTasks}`)
       .text(`Task Completion Rate: ${totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%`)
       .moveDown()
       .text(`Total Revisions: ${totalRevisions}`)
       .text(`Completed Revisions: ${completedRevisions}`)
       .text(`Revision Completion Rate: ${totalRevisions > 0 ? Math.round((completedRevisions / totalRevisions) * 100) : 0}%`)
       .moveDown(2);

    // Add footer
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#999999')
       .text('Generated by SumiTask - Plan, revise, and achieve — the Suman way.', { align: 'center' });

    // Finalize PDF
    doc.end();
  })
);

export default router; 