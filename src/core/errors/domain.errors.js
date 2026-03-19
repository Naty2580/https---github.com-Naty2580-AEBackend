import { AppError } from './AppError.js';

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = []) {
    super(message, 400);
    this.errors = errors; // Useful for passing Zod issue arrays
  }
}

export class BusinessLogicError extends AppError {
  constructor(message = 'Business rule violation') {
    super(message, 422); // 422 Unprocessable Entity is standard for domain rule breaks
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409); // e.g., Deliverer tries to accept an order already assigned
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden action') {
    super(message, 403);
  }
}