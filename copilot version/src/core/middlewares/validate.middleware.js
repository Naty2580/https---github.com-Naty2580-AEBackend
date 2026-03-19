import { z } from 'zod';

const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req);
    next();
  } catch (error) {
    const errors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors,
    });
  }
};

export default validate;