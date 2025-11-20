import express from 'express';
import passport from 'passport';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { dbHelpers } from '../config/database.js';
import { generateToken, optionalAuth, verifyToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logHelpers } from '../utils/logger.js';
import { AuthenticationError, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Google OAuth routes
router.get('/google',
  (req, res, next) => {
    // Check if Google OAuth is configured
    if (!process.env.GOOGLE_CLIENT_ID || 
        !process.env.GOOGLE_CLIENT_SECRET || 
        process.env.GOOGLE_CLIENT_ID === 'your-google-client-id' ||
        process.env.GOOGLE_CLIENT_SECRET === 'your-google-client-secret') {
      return res.status(503).json({
        success: false,
        error: {
          message: 'Google OAuth is not configured. Please use guest login instead.',
          statusCode: 503
        }
      });
    }
    next();
  },
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
);

router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/auth/failure',
    session: false 
  }),
  asyncHandler(async (req, res) => {
    try {
      const { user } = req;
      
      if (!user) {
        throw new AuthenticationError('Google authentication failed');
      }

      // Generate JWT token
      const token = generateToken(user.user_id);
      
      logHelpers.logAuth('google_login_success', user.user_id, true);
      
      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`);
    } catch (error) {
      logHelpers.logAuth('google_login_failure', null, false);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent(error.message)}`);
    }
  })
);

// Rate limiter for guest creation - more lenient
const guestRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 50 : 10, // 50 in development, 10 in production
  message: {
    error: 'Too many guest creation attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Create guest user
router.post('/guest',
  guestRateLimit,
  [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required and must be less than 100 characters'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { name } = req.body;

    // Check if guest user already exists with this name
    const existingGuest = await dbHelpers.get(
      'SELECT user_id, name FROM users WHERE name = ? AND is_guest = TRUE',
      [name]
    );

    if (existingGuest) {
      // Return existing guest user
      const token = generateToken(existingGuest.user_id);
      
      logHelpers.logAuth('guest_login_existing', existingGuest.user_id, true);
      
      res.json({
        success: true,
        data: {
          token,
          user: {
            user_id: existingGuest.user_id,
            name: existingGuest.name,
            is_guest: true
          }
        }
      });
      return;
    }

    // Create new guest user
    const result = await dbHelpers.run(
      'INSERT INTO users (name, email, is_guest) VALUES (?, ?, TRUE)',
      [name, `guest_${Date.now()}@sumitask.local`]
    );

    const guestUser = {
      user_id: result.lastID,
      name,
      is_guest: true
    };

    const token = generateToken(guestUser.user_id);
    
    logHelpers.logAuth('guest_created', guestUser.user_id, true);
    
    res.status(201).json({
      success: true,
      data: {
        token,
        user: guestUser
      }
    });
  })
);

// Get current user
router.get('/me',
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    res.json({
      success: true,
      data: {
        user: {
          user_id: req.user.user_id,
          name: req.user.name,
          email: req.user.email,
          is_guest: req.user.is_guest
        }
      }
    });
  })
);

// Update user profile
router.put('/profile',
  [
    body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be less than 100 characters'),
  ],
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { name } = req.body;
    const updates = [];
    const params = [];

    if (name && name !== req.user.name) {
      updates.push('name = ?');
      params.push(name);
    }

    if (updates.length === 0) {
      return res.json({
        success: true,
        data: {
          user: {
            user_id: req.user.user_id,
            name: req.user.name,
            email: req.user.email,
            is_guest: req.user.is_guest
          }
        }
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.user.user_id);

    await dbHelpers.run(
      `UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`,
      params
    );

    // Get updated user
    const updatedUser = await dbHelpers.get(
      'SELECT user_id, name, email, is_guest FROM users WHERE user_id = ?',
      [req.user.user_id]
    );

    logHelpers.logAuth('profile_updated', req.user.user_id, true);
    
    res.json({
      success: true,
      data: {
        user: updatedUser
      }
    });
  })
);

// Delete user account
router.delete('/account',
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    // Delete user and all associated data (cascade)
    await dbHelpers.run(
      'DELETE FROM users WHERE user_id = ?',
      [req.user.user_id]
    );

    logHelpers.logAuth('account_deleted', req.user.user_id, true);
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  })
);

// Test endpoint to verify middleware
router.get('/test',
  verifyToken,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      message: 'Middleware working!',
      user: req.user
    });
  })
);

// Check authentication status
router.get('/check',
  asyncHandler(async (req, res) => {
    // Manual token verification
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({
        success: true,
        data: {
          isAuthenticated: false
        }
      });
    }

    try {
      const token = authHeader.substring(7);
      const jwt = await import('jsonwebtoken');
      const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
      const user = await dbHelpers.get(
        'SELECT user_id, name, email, google_id, is_guest FROM users WHERE user_id = ?',
        [decoded.userId]
      );

      if (!user) {
        return res.json({
          success: true,
          data: {
            isAuthenticated: false
          }
        });
      }

      res.json({
        success: true,
        data: {
          isAuthenticated: true,
          user: {
            id: user.user_id,
            name: user.name,
            email: user.email,
            is_guest: user.is_guest
          }
        }
      });
    } catch (error) {
      console.log('Token verification error:', error.message);
      res.json({
        success: true,
        data: {
          isAuthenticated: false
        }
      });
    }
  })
);

// Logout
router.post('/logout',
  asyncHandler(async (req, res) => {
    if (req.user) {
      logHelpers.logAuth('logout', req.user.user_id, true);
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  })
);

// Auth failure route
router.get('/failure', (req, res) => {
  logHelpers.logAuth('oauth_failure', null, false);
  res.status(401).json({
    success: false,
    error: {
      message: 'Authentication failed',
      statusCode: 401
    }
  });
});

// Health check for auth service
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Auth service is healthy',
    timestamp: new Date().toISOString()
  });
});

export default router; 