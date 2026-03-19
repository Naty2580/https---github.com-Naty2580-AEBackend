// Note: Assuming config is written in ESM
import config from '../../config/env.config.js'; 
import { AppError } from '../../core/errors/AppError.js';

/**
 * Global Error Handler Middleware
 * Intercepts all thrown errors in the application.
 */
export const globalErrorHandler = (err, req, res, next) => {
  let error = err;

  // Fallback default values
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';

  // Handle specific known errors that don't extend AppError (e.g., Prisma, JWT)
  if (error.name === 'ZodError') {
    statusCode = 400;
    message = 'Data Validation Failed';
    error.isOperational = true;
    error.errors = error.issues; // Map Zod issues
  }

  // Prisma unique constraint violation (Modern Prisma Error Code)
  if (error.code === 'P2002') {
    statusCode = 409;
    message = 'Duplicate field value entered';
    error.isOperational = true;
  }

  // If it's not an operational error (e.g., a real code bug), log it aggressively
  if (!error.isOperational) {
    console.error('🔥 [CRITICAL PROGRAMMER ERROR]:', error);
    
    // Do not leak system info to client in production
    if (config.NODE_ENV === 'production') {
      message = 'Something went very wrong. Our team has been notified.';
    }
  }

  // Construct standard response payload
  const errorResponse = {
    success: false,
    message,
    ...(error.errors && { errors: error.errors }), // Include validation details if present
    ...(config.NODE_ENV === 'development' && { stack: error.stack }) // Leak stack only in dev
  };

  res.status(statusCode).json(errorResponse);
};