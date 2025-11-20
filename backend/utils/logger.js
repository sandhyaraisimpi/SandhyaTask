import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which level to log based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define format for console logs
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define format for file logs
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
  }),
  
  // Error file transport
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/error.log'),
    level: 'error',
    format: fileFormat,
  }),
  
  // Combined file transport
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/combined.log'),
    format: fileFormat,
  }),
];

// Create the logger
export const logger = winston.createLogger({
  level: level(),
  levels,
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan
export const stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Helper functions for specific log types
export const logHelpers = {
  // Log API requests
  logRequest: (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    next();
  },

  // Log errors with context
  logError: (error, req = null) => {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    };

    if (req) {
      errorInfo.request = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.user_id,
      };
    }

    logger.error('Application Error:', errorInfo);
  },

  // Log database operations
  logDatabase: (operation, table, duration, success = true) => {
    const level = success ? 'info' : 'error';
    logger[level](`DB ${operation} on ${table} - ${duration}ms`);
  },

  // Log authentication events
  logAuth: (event, userId, success = true) => {
    const level = success ? 'info' : 'warn';
    logger[level](`Auth ${event} - User: ${userId} - Success: ${success}`);
  },

  // Log file operations
  logFile: (operation, filename, size, success = true) => {
    const level = success ? 'info' : 'error';
    logger[level](`File ${operation} - ${filename} (${size} bytes) - Success: ${success}`);
  },

  // Log WhatsApp events
  logWhatsApp: (event, userId, message = '') => {
    logger.info(`WhatsApp ${event} - User: ${userId} - ${message}`);
  },

  // Log PDF generation
  logPDF: (operation, userId, taskCount, success = true) => {
    const level = success ? 'info' : 'error';
    logger[level](`PDF ${operation} - User: ${userId} - Tasks: ${taskCount} - Success: ${success}`);
  },

  // Log performance metrics
  logPerformance: (operation, duration, metadata = {}) => {
    const level = duration > 1000 ? 'warn' : 'info';
    logger[level](`Performance ${operation} - ${duration}ms`, metadata);
  },

  // Log security events
  logSecurity: (event, ip, userId = null, details = {}) => {
    logger.warn(`Security ${event} - IP: ${ip} - User: ${userId}`, details);
  },
};

// Middleware for request logging
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log the request
  logger.info(`${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  
  // Log the response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  
  next();
};

// Middleware for error logging
export const errorLogger = (error, req, res, next) => {
  logHelpers.logError(error, req);
  next(error);
};

// Export default logger instance
export default logger; 