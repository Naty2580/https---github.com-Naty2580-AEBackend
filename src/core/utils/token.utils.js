import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import config from '../../config/env.config.js';

export const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role, status: user.status },
    config.JWT_ACCESS_SECRET,
    { expiresIn: config.JWT_ACCESS_EXPIRES_IN || '30d' }
  );
};

export const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};