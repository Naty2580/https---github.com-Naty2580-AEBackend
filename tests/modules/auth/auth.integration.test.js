import { jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../../../src/api/server.js';
import { authService } from '../../../src/modules/auth/auth.controller.js';
import prisma from '../../../src/infrastructure/database/prisma.client.js';
import { 
  ForbiddenError, 
  UnauthorizedError, 
  ConflictError, 
  BusinessLogicError 
} from '../../../src/core/errors/domain.errors.js';
import { AUTH_ERRORS } from '../../../src/core/errors/error.codes.js';

// Define environment as test to bypass rate limiter
process.env.NODE_ENV = 'test';

describe('Authentication API Integration & Security Tests', () => {
  
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    // Explicitly disconnect Prisma to prevent Jest from hanging
    await prisma.$disconnect();
    await new Promise(resolve => setTimeout(() => resolve(), 500));
  });

  // ==========================================
  // 1. REGISTRATION FLOW
  // ==========================================
  describe('POST /api/v1/auth/register', () => {
    const validRegisterPayload = {
      telegramId: 123456789,
      astuEmail: 'freshman@astu.edu.et',
      fullName: 'Astu Freshman',
      phoneNumber: '0911223344',
      password: 'SecurePassword123!'
    };

    it('should successfully register a valid user and return 201 Created', async () => {
      jest.spyOn(authService, 'register').mockResolvedValue({
        id: 'user-uuid-123',
        astuEmail: 'freshman@astu.edu.et',
        role: 'CUSTOMER'
      });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegisterPayload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should fail with 400 Validation Error if email is not an @astu.edu.et domain', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...validRegisterPayload, astuEmail: 'hacker@gmail.com' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Data Validation Failed');
    });

    it('should fail with 400 Validation Error if password is too short', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...validRegisterPayload, password: 'short' });

      expect(response.status).toBe(400);
    });

    it('should fail with 409 Conflict if user email already exists', async () => {
      jest.spyOn(authService, 'register').mockRejectedValue(
        new ConflictError('User with this email already exists')
      );

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegisterPayload);

      expect(response.status).toBe(409);
    });
  });

  // ==========================================
  // 2. LOGIN FLOW
  // ==========================================
  describe('POST /api/v1/auth/login', () => {
    const validLoginPayload = {
      astuEmail: 'student@astu.edu.et',
      password: 'Password123!'
    };

    it('should successfully login and return secure httpOnly cookie', async () => {
      jest.spyOn(authService, 'login').mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: { id: '123', fullName: 'Test', role: 'STUDENT' }
      });

      const response = await request(app).post('/api/v1/auth/login').send(validLoginPayload);

      expect(response.status).toBe(200);
      expect(response.headers['set-cookie'][0]).toMatch(/refreshToken=mock-refresh-token/);
    });

    it('should fail with 401 Unauthorized for invalid credentials', async () => {
      jest.spyOn(authService, 'login').mockRejectedValue(
        new UnauthorizedError(AUTH_ERRORS.INVALID_CREDENTIALS)
      );

      const response = await request(app).post('/api/v1/auth/login').send(validLoginPayload);
      expect(response.status).toBe(401);
    });
  });

  // ==========================================
  // 3. EMAIL VERIFICATION
  // ==========================================
  describe('POST /api/v1/auth/verify-email', () => {
    it('should verify email successfully with valid OTP', async () => {
      jest.spyOn(authService, 'verifyEmail').mockResolvedValue(true);
      const response = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ astuEmail: 'student@astu.edu.et', otp: '123456' });
      expect(response.status).toBe(200);
    });

    it('should fail with 422 if OTP is invalid or expired', async () => {
      jest.spyOn(authService, 'verifyEmail').mockRejectedValue(
        new BusinessLogicError('OTP expired or invalid')
      );
      const response = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ astuEmail: 'student@astu.edu.et', otp: '000000' });
      expect(response.status).toBe(422);
    });
  });

  // ==========================================
  // 4. SESSION MANAGEMENT
  // ==========================================
  describe('POST /api/v1/auth/refresh', () => {
    it('should fail with 401 if no refresh token cookie is provided', async () => {
      const response = await request(app).post('/api/v1/auth/refresh');
      expect(response.status).toBe(401);
    });

    it('should refresh tokens and issue a new cookie', async () => {
      jest.spyOn(authService, 'refreshAccess').mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      });
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', ['refreshToken=valid-old-token']);
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should clear the httpOnly cookie on logout', async () => {
      jest.spyOn(authService, 'logout').mockResolvedValue(true);
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', ['refreshToken=valid-token']);
      expect(response.status).toBe(200);
      expect(response.headers['set-cookie'][0]).toMatch(/Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
    });
  });
});