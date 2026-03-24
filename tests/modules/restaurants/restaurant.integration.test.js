import { jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../../../src/api/server.js';
import prisma from '../../../src/infrastructure/database/prisma.client.js';

jest.setTimeout(30000); 

describe('Restaurant & Menu Scenario Integration Tests', () => {
  let adminToken;
  let vendorToken;
  let restaurantId;
  let vendorId;

  beforeAll(async () => {
    try {
      // 1. Force clear DB
      await prisma.refreshToken.deleteMany();
      await prisma.userAuditLog.deleteMany();
      await prisma.vendorProfile.deleteMany();
      await prisma.menuItem.deleteMany();
      await prisma.category.deleteMany();
      await prisma.restaurant.deleteMany();
      await prisma.user.deleteMany();

      // 2. Setup Admin
      const adminEmail = `admin_${Date.now()}@astu.edu.et`;
      await request(app).post('/api/v1/auth/register').send({
        // FIX: Send as regular number. Zod's z.coerce.bigint() will handle the conversion server-side.
        telegramId: Math.floor(Math.random() * 1000000), 
        astuEmail: adminEmail,
        fullName: 'Test Admin',
        phoneNumber: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'Password123!',
      });
      
      await prisma.user.update({
        where: { astuEmail: adminEmail },
        data: { isEmailVerified: true, role: 'ADMIN' }
      });

      const adminLogin = await request(app).post('/api/v1/auth/login').send({
        astuEmail: adminEmail,
        password: 'Password123!'
      });
      adminToken = adminLogin.body.data.accessToken;

      // 3. Setup Vendor Staff
      const vendorEmail = `vendor_${Date.now()}@astu.edu.et`;
      await request(app).post('/api/v1/auth/register').send({
        telegramId: Math.floor(Math.random() * 1000000), 
        astuEmail: vendorEmail,
        fullName: 'Test Vendor',
        phoneNumber: `07${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'Password123!',
      });

      const vendorUser = await prisma.user.update({
        where: { astuEmail: vendorEmail },
        data: { isEmailVerified: true }
      });
      vendorId = vendorUser.id;

      const vendorLogin = await request(app).post('/api/v1/auth/login').send({
        astuEmail: vendorEmail,
        password: 'Password123!'
      });
      vendorToken = vendorLogin.body.data.accessToken;

    } catch (error) {
      console.error('❌ Setup failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  describe('Success Scenarios', () => {
    it('Step 1: Admin creates restaurant', async () => {
      const res = await request(app)
        .post('/api/v1/restaurants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Central Cafe',
          mode: 'VENDOR_MANAGED',
          location: 'Block 01',
          phone: '0912345678',
          lat: 8.5,
          lng: 39.2
        });

      expect(res.status).toBe(201);
      restaurantId = res.body.data.id;
    });

    it('Step 2: Admin assigns vendor staff', async () => {
      const res = await request(app)
        .post('/api/v1/users/assign-vendor')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: vendorId,
          restaurantId: restaurantId,
          isOwner: true
        });

      expect(res.status).toBe(200);
    });

    it('Step 3: Vendor staff creates a category', async () => {
      const res = await request(app)
        .post(`/api/v1/restaurants/${restaurantId}/menus/categories`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ name: 'Lunch', sortOrder: 1 });

      expect(res.status).toBe(201);
    });
  });

  describe('Security & Logic Scenarios', () => {
    it('should reject unauthorized user from creating restaurant', async () => {
      const res = await request(app)
        .post('/api/v1/restaurants')
        .set('Authorization', `Bearer ${vendorToken}`) 
        .send({ name: 'Hacker Cafe', location: 'Hidden', lat: 8, lng: 39 });

      expect(res.status).toBe(403);
    });
  });
});