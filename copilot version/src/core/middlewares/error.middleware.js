import AppError from '../errors/AppError.js';

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Prisma errors
  if (err.code === 'P2002') {
    error = new AppError('Duplicate field value', 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401);
  }

  res.status(error.statusCode || 500).json({
    status: error.status,
    message: error.message,
  });
};

export default errorHandler;