import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { dbHelpers } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logHelpers } from '../utils/logger.js';
import { AuthenticationError, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // limit each IP to 5 requests per windowMs
};

// Register a new user
router.post('/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().notEmpty(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid input', errors.array());
    }

    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await dbHelpers.get(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      throw new AuthenticationError('User already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const result = await dbHelpers.run(
      `INSERT INTO users (email, password_hash, name, is_local_auth) 
       VALUES (?, ?, ?, ?)`,
      [email, hashedPassword, name, true]
    );

    const user = {
      user_id: result.lastID,
      email,
      name,
      is_local_auth: true
    };

    // Generate JWT token
    const token = generateToken(user);

    logHelpers.logAuth('local_register', user.user_id, true);

    res.json({
      success: true,
      data: {
        user,
        token
      }
    });
  })
);

// Login with email/password
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').exists(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid input', errors.array());
    }

    const { email, password } = req.body;

    // Get user
    const user = await dbHelpers.get(
      'SELECT user_id, email, name, password_hash FROM users WHERE email = ? AND is_local_auth = true',
      [email]
    );

    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Remove password_hash from user object
    delete user.password_hash;

    // Generate JWT token
    const token = generateToken(user);

    logHelpers.logAuth('local_login', user.user_id, true);

    res.json({
      success: true,
      data: {
        user,
        token
      }
    });
  })
);

export default router;