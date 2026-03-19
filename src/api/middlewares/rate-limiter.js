import rateLimit from 'express-rate-limit';

export const authRateLimiter = process.env.NODE_ENV === 'test' 
  ? (req, res, next) => next() 
  : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login/register requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
    error_code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});