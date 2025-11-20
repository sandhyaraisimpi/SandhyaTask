import jwt from 'jsonwebtoken';
import { dbHelpers } from '../config/database.js';
import { AuthenticationError, AuthorizationError } from './errorHandler.js';
import { logHelpers } from '../utils/logger.js';

// Verify JWT token
export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await dbHelpers.get(
      'SELECT user_id, name, email, google_id, is_guest FROM users WHERE user_id = ?',
      [decoded.userId]
    );

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Add user to request object
    req.user = user;
    
    logHelpers.logAuth('token_verified', user.user_id, true);
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logHelpers.logAuth('invalid_token', null, false);
      return next(new AuthenticationError('Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      logHelpers.logAuth('expired_token', null, false);
      return next(new AuthenticationError('Token expired'));
    }
    next(error);
  }
};

// Optional authentication (doesn't throw error if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('optionalAuth - authHeader:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('optionalAuth - no valid auth header, continuing without user');
      return next(); // Continue without user
    }

    const token = authHeader.substring(7);
    console.log('optionalAuth - token:', token);
    
    if (!token) {
      console.log('optionalAuth - no token, continuing without user');
      return next(); // Continue without user
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('optionalAuth - decoded token:', decoded);
    
    // Get user from database
    const user = await dbHelpers.get(
      'SELECT user_id, name, email, google_id, is_guest FROM users WHERE user_id = ?',
      [decoded.userId]
    );
    console.log('optionalAuth - user found:', user);

    if (user) {
      req.user = user;
      console.log('optionalAuth - setting req.user:', user);
      logHelpers.logAuth('optional_auth_success', user.user_id, true);
    }
    
    next();
  } catch (error) {
    console.log('optionalAuth - error:', error.message);
    // Don't throw error for optional auth, just continue
    next();
  }
};

// Require guest user
export const requireGuest = (req, res, next) => {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required'));
  }
  
  if (!req.user.is_guest) {
    return next(new AuthorizationError('Guest access required'));
  }
  
  next();
};

// Require authenticated user (non-guest)
export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required'));
  }
  
  if (req.user.is_guest) {
    return next(new AuthorizationError('Full authentication required'));
  }
  
  next();
};

// Check if user owns the resource
export const requireOwnership = (table, idField = 'id') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AuthenticationError('Authentication required'));
      }

      const resourceId = req.params[idField];
      
      if (!resourceId) {
        return next(new AuthenticationError('Resource ID required'));
      }

      // Check if user owns the resource
      const resource = await dbHelpers.get(
        `SELECT user_id FROM ${table} WHERE ${idField} = ?`,
        [resourceId]
      );

      if (!resource) {
        return next(new AuthenticationError('Resource not found'));
      }

      if (resource.user_id !== req.user.user_id) {
        logHelpers.logSecurity('unauthorized_access', req.ip, req.user.user_id, {
          resource: `${table}:${resourceId}`,
          attemptedBy: req.user.user_id,
          owner: resource.user_id
        });
        return next(new AuthorizationError('Access denied'));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Generate JWT token
export const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Refresh token middleware
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new AuthenticationError('Refresh token required');
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await dbHelpers.get(
      'SELECT user_id, name, email, google_id, is_guest FROM users WHERE user_id = ?',
      [decoded.userId]
    );

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Generate new access token
    const newToken = generateToken(user.user_id);
    
    logHelpers.logAuth('token_refreshed', user.user_id, true);
    
    res.json({
      success: true,
      data: {
        token: newToken,
        user: {
          user_id: user.user_id,
          name: user.name,
          email: user.email,
          is_guest: user.is_guest
        }
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AuthenticationError('Invalid refresh token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AuthenticationError('Refresh token expired'));
    }
    next(error);
  }
};

// Rate limiting for authentication endpoints
export const authRateLimit = {
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per windowMs
    message: {
      error: 'Too many login attempts, please try again later.'
    }
  },
  register: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // limit each IP to 3 registration attempts per hour
    message: {
      error: 'Too many registration attempts, please try again later.'
    }
  }
};

// Logout middleware (optional - for token blacklisting)
export const logout = async (req, res, next) => {
  try {
    if (req.user) {
      // Log the logout event
      logHelpers.logAuth('logout', req.user.user_id, true);
      
      // You could implement token blacklisting here
      // await blacklistToken(req.headers.authorization.substring(7));
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
}; 