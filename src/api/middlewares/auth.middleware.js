import jwt from 'jsonwebtoken';
import config from '../../config/env.config.js';
import { UnauthorizedError } from '../../core/errors/domain.errors.js';
import { AUTH_ERRORS } from '../../core/errors/error.codes.js';

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication token missing or invalid');
  }

  const token = authHeader.split(' ')[1];

  if (!token) throw new UnauthorizedError(AUTH_ERRORS.UNAUTHORIZED);
  
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { status: true, role: true, activeMode: true }
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError(AUTH_ERRORS.USER_BANNED);
    }

    req.user = decoded; 

    if (req.user.status !== 'ACTIVE') {
      return next(new UnauthorizedError(AUTH_ERRORS.USER_BANNED));
    }

    next();
  } catch (error) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError(AUTH_ERRORS.TOKEN_EXPIRED));
    }
    return next(new UnauthorizedError(AUTH_ERRORS.UNAUTHORIZED));
  } 
};