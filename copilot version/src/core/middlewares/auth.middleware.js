import jwt from 'jsonwebtoken';
import AppError from '../errors/AppError.js';

const protect = (req, res, next) => {
  try {
    // Check for token in Authorization header or cookies
    let token = req.headers.authorization?.split(' ')[1];
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next(new AppError('Access token required', 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return next(new AppError('Invalid token', 401));
  }
};

export { protect };