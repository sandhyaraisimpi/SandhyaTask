import express from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbHelpers } from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ValidationError } from '../middleware/errorHandler.js';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyToken);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow PDF, images, and common document formats
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ValidationError('Invalid file type. Only PDF, images, and documents are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  }
});

// Upload PDF for revision
router.post('/pdf',
  upload.single('pdf'),
  [
    body('title').isString().isLength({ min: 1, max: 255 }),
    body('description').optional().isString().isLength({ max: 1000 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const userId = req.user.user_id;
    const { title, description } = req.body;

    // Validate file type
    if (req.file.mimetype !== 'application/pdf') {
      throw new ValidationError('Only PDF files are allowed for this endpoint');
    }

    try {
      // Save PDF record to database
      const result = await dbHelpers.run(
        `INSERT INTO pdfs (user_id, original_title, file_url, file_size)
         VALUES (?, ?, ?, ?)`,
        [
          userId,
          title,
          req.file.filename,
          req.file.size
        ]
      );

      // Log the action
      await dbHelpers.run(
        'INSERT INTO audit_logs (user_id, action_type, entity, metadata) VALUES (?, ?, ?, ?)',
        [
          userId,
          'pdf_uploaded',
          'pdf',
          JSON.stringify({ 
            pdf_id: result.lastID, 
            title, 
            filename: req.file.filename,
            size: req.file.size 
          })
        ]
      );

      res.json({
        success: true,
        message: 'PDF uploaded successfully',
        data: {
          pdf_id: result.lastID,
          title,
          filename: req.file.filename,
          size: req.file.size,
          uploaded_at: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error uploading PDF:', error);
      throw new ValidationError('Failed to upload PDF');
    }
  })
);

// Upload blank page for revision
router.post('/blank-page',
  upload.single('blank_page'),
  [
    body('pdf_id').optional().isInt(),
    body('description').optional().isString().isLength({ max: 500 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const userId = req.user.user_id;
    const { pdf_id, description } = req.body;

    // Validate file type (images only for blank pages)
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedImageTypes.includes(req.file.mimetype)) {
      throw new ValidationError('Only image files are allowed for blank page uploads');
    }

    try {
      // Verify PDF ownership if pdf_id is provided
      if (pdf_id) {
        const pdf = await dbHelpers.get(
          'SELECT pdf_id FROM pdfs WHERE pdf_id = ? AND user_id = ?',
          [pdf_id, userId]
        );

        if (!pdf) {
          throw new ValidationError('PDF not found or access denied');
        }
      }

      // Process image if needed (resize, optimize)
      let processedFilename = req.file.filename;
      
      if (req.file.mimetype !== 'image/webp') {
        // Convert to WebP for better compression
        const inputPath = req.file.path;
        const outputPath = inputPath.replace(path.extname(inputPath), '.webp');
        
        await sharp(inputPath)
          .webp({ quality: 85 })
          .toFile(outputPath);
        
        processedFilename = path.basename(outputPath);
        
        // Remove original file
        const fs = await import('fs');
        fs.unlinkSync(inputPath);
      }

      // Save blank page record to database
      const result = await dbHelpers.run(
        `INSERT INTO blank_pages (user_id, pdf_id, file_url, file_size, upload_date)
         VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          pdf_id || null,
          processedFilename,
          req.file.size
        ]
      );

      // Log the action
      await dbHelpers.run(
        'INSERT INTO audit_logs (user_id, action_type, entity, metadata) VALUES (?, ?, ?, ?)',
        [
          userId,
          'blank_page_uploaded',
          'blank_page',
          JSON.stringify({ 
            page_id: result.lastID, 
            pdf_id, 
            filename: processedFilename,
            size: req.file.size 
          })
        ]
      );

      res.json({
        success: true,
        message: 'Blank page uploaded successfully',
        data: {
          page_id: result.lastID,
          filename: processedFilename,
          size: req.file.size,
          uploaded_at: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error uploading blank page:', error);
      throw new ValidationError('Failed to upload blank page');
    }
  })
);

// Get user's uploaded PDFs
router.get('/pdfs',
  asyncHandler(async (req, res) => {
    const userId = req.user.user_id;

    const pdfs = await dbHelpers.all(
      `SELECT 
        pdf_id,
        original_title,
        file_url,
        file_size,
        uploaded_at,
        COUNT(bp.page_id) as blank_pages_count
      FROM pdfs p
      LEFT JOIN blank_pages bp ON p.pdf_id = bp.pdf_id
      WHERE p.user_id = ?
      GROUP BY p.pdf_id
      ORDER BY p.uploaded_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: pdfs
    });
  })
);

// Get user's blank pages
router.get('/blank-pages',
  asyncHandler(async (req, res) => {
    const userId = req.user.user_id;

    const blankPages = await dbHelpers.all(
      `SELECT 
        bp.page_id,
        bp.file_url,
        bp.file_size,
        bp.upload_date,
        bp.comparison_score,
        p.original_title as pdf_title
      FROM blank_pages bp
      LEFT JOIN pdfs p ON bp.pdf_id = p.pdf_id
      WHERE bp.user_id = ?
      ORDER BY bp.upload_date DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: blankPages
    });
  })
);

// Delete uploaded file
router.delete('/:fileType/:fileId',
  [
    body('fileType').isIn(['pdf', 'blank-page'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const userId = req.user.user_id;
    const { fileType, fileId } = req.params;

    try {
      let fileRecord;
      let tableName;
      let idColumn;

      if (fileType === 'pdf') {
        tableName = 'pdfs';
        idColumn = 'pdf_id';
        fileRecord = await dbHelpers.get(
          'SELECT * FROM pdfs WHERE pdf_id = ? AND user_id = ?',
          [fileId, userId]
        );
      } else if (fileType === 'blank-page') {
        tableName = 'blank_pages';
        idColumn = 'page_id';
        fileRecord = await dbHelpers.get(
          'SELECT * FROM blank_pages WHERE page_id = ? AND user_id = ?',
          [fileId, userId]
        );
      }

      if (!fileRecord) {
        throw new ValidationError('File not found or access denied');
      }

      // Delete file from filesystem
      const filePath = path.join(__dirname, '../uploads', fileRecord.file_url);
      const fs = await import('fs');
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete record from database
      await dbHelpers.run(
        `DELETE FROM ${tableName} WHERE ${idColumn} = ?`,
        [fileId]
      );

      // Log the action
      await dbHelpers.run(
        'INSERT INTO audit_logs (user_id, action_type, entity, metadata) VALUES (?, ?, ?, ?)',
        [
          userId,
          `${fileType}_deleted`,
          fileType,
          JSON.stringify({ 
            file_id: fileId, 
            filename: fileRecord.file_url 
          })
        ]
      );

      res.json({
        success: true,
        message: `${fileType} deleted successfully`
      });

    } catch (error) {
      console.error(`Error deleting ${fileType}:`, error);
      throw new ValidationError(`Failed to delete ${fileType}`);
    }
  })
);

// Update comparison score for blank page
router.patch('/blank-page/:pageId/score',
  [
    body('score').isFloat({ min: 0, max: 100 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const userId = req.user.user_id;
    const { pageId } = req.params;
    const { score } = req.body;

    // Verify ownership
    const blankPage = await dbHelpers.get(
      'SELECT page_id FROM blank_pages WHERE page_id = ? AND user_id = ?',
      [pageId, userId]
    );

    if (!blankPage) {
      throw new ValidationError('Blank page not found or access denied');
    }

    // Update comparison score
    await dbHelpers.run(
      'UPDATE blank_pages SET comparison_score = ? WHERE page_id = ?',
      [score, pageId]
    );

    // Log the action
    await dbHelpers.run(
      'INSERT INTO audit_logs (user_id, action_type, entity, metadata) VALUES (?, ?, ?, ?)',
      [
        userId,
        'comparison_score_updated',
        'blank_page',
        JSON.stringify({ page_id: pageId, score })
      ]
    );

    res.json({
      success: true,
      message: 'Comparison score updated successfully',
      data: { score }
    });
  })
);

// Get file statistics
router.get('/stats',
  asyncHandler(async (req, res) => {
    const userId = req.user.user_id;

    const stats = await dbHelpers.get(
      `SELECT 
        COUNT(DISTINCT p.pdf_id) as total_pdfs,
        COUNT(DISTINCT bp.page_id) as total_blank_pages,
        SUM(p.file_size) as total_pdf_size,
        SUM(bp.file_size) as total_blank_page_size,
        AVG(bp.comparison_score) as avg_comparison_score
      FROM users u
      LEFT JOIN pdfs p ON u.user_id = p.user_id
      LEFT JOIN blank_pages bp ON u.user_id = bp.user_id
      WHERE u.user_id = ?`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        total_pdfs: stats.total_pdfs || 0,
        total_blank_pages: stats.total_blank_pages || 0,
        total_pdf_size: stats.total_pdf_size || 0,
        total_blank_page_size: stats.total_blank_page_size || 0,
        avg_comparison_score: stats.avg_comparison_score || 0
      }
    });
  })
);

export default router; 