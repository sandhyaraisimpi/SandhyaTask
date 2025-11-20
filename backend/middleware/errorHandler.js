import { logger, logHelpers } from '../utils/logger.js';

// Custom error classes
export class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
  }
}

// Error handler middleware
export const errorHandler = (error, req, res, next) => {
  let { statusCode, message, errors } = error;

  // Log the error
  logHelpers.logError(error, req);

  // Set default status code if not provided
  if (!statusCode) {
    statusCode = 500;
  }

  // Set default message if not provided
  if (!message) {
    message = 'Internal server error';
  }

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(error.errors).map(err => err.message);
  }

  if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  if (error.code === 11000) {
    statusCode = 409;
    message = 'Duplicate field value';
  }

  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Handle SQLite errors
  if (error.code === 'SQLITE_CONSTRAINT') {
    statusCode = 409;
    message = 'Database constraint violation';
  }

  if (error.code === 'SQLITE_NOTFOUND') {
    statusCode = 404;
    message = 'Resource not found';
  }

  // Create error response
  const errorResponse = {
    success: false,
    error: {
      message,
      statusCode,
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
        details: error.message
      })
    }
  };

  // Add validation errors if present
  if (errors && errors.length > 0) {
    errorResponse.error.errors = errors;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
};

// Validation error handler
export const validationErrorHandler = (error, req, res, next) => {
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
    
    const validationError = new ValidationError('Validation failed', errors);
    return next(validationError);
  }
  next(error);
};

// Database error handler
export const databaseErrorHandler = (error, req, res, next) => {
  if (error.code && error.code.startsWith('SQLITE_')) {
    logger.error('Database error:', error);
    
    switch (error.code) {
      case 'SQLITE_CONSTRAINT':
        return next(new ConflictError('Data constraint violation'));
      case 'SQLITE_NOTFOUND':
        return next(new NotFoundError('Resource not found'));
      case 'SQLITE_BUSY':
        return next(new AppError('Database is busy, please try again', 503));
      default:
        return next(new AppError('Database error occurred', 500));
    }
  }
  next(error);
};

// File upload error handler
export const fileUploadErrorHandler = (error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return next(new AppError('File too large', 400));
  }
  if (error.code === 'LIMIT_FILE_COUNT') {
    return next(new AppError('Too many files', 400));
  }
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return next(new AppError('Unexpected file field', 400));
  }
  next(error);
};

// Rate limit error handler
export const rateLimitErrorHandler = (error, req, res, next) => {
  if (error.status === 429) {
    return res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests, please try again later',
        statusCode: 429,
        retryAfter: error.headers?.['retry-after'] || 60
      }
    });
  }
  next(error);
};

// Global error handlers
export const globalErrorHandlers = {
  // Handle uncaught exceptions
  uncaughtException: (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  },

  // Handle unhandled promise rejections
  unhandledRejection: (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  },

  // Handle SIGTERM
  sigterm: () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  },

  // Handle SIGINT
  sigint: () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  }
};

// Register global error handlers
export const registerGlobalErrorHandlers = () => {
  process.on('uncaughtException', globalErrorHandlers.uncaughtException);
  process.on('unhandledRejection', globalErrorHandlers.unhandledRejection);
  process.on('SIGTERM', globalErrorHandlers.sigterm);
  process.on('SIGINT', globalErrorHandlers.sigint);
}; 