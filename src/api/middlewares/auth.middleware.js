import jwt from 'jsonwebtoken';
import config from '../../config/env.config.js';
import prisma from '../../infrastructure/database/prisma.client.js';
import { UnauthorizedError } from '../../core/errors/domain.errors.js';
import { AUTH_ERRORS } from '../../core/errors/error.codes.js';

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication token missing or invalid');
  }

  const token = authHeader.split(' ')[1];

  if (!config.JWT_ACCESS_SECRET) {
      throw new Error("JWT_ACCESS_SECRET is not defined in configuration");
    }

  if (!token) throw new UnauthorizedError(AUTH_ERRORS.UNAUTHORIZED);
  
  try {
    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { status: true, role: true, activeMode: true }
    });

    if (!user) {
      throw new UnauthorizedError(AUTH_ERRORS.UNAUTHORIZED);
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError(AUTH_ERRORS.USER_BANNED);
    }

     req.user = { 
      id: decoded.id, 
      role: user.role, 
      activeMode: user.activeMode 
    }; 


    next();
  } catch (error) {
     if (error.isOperational) return next(error);

    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError(AUTH_ERRORS.TOKEN_EXPIRED));
    }

    // Fallback for verification failures
    return next(new UnauthorizedError(AUTH_ERRORS.UNAUTHORIZED));
  }
};