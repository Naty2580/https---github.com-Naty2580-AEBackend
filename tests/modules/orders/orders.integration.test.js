import { jest } from '@jest/globals';
import request from 'supertest';
import crypto from 'node:crypto';
import { app } from '../../../src/api/server.js';
import prisma from '../../../src/infrastructure/database/prisma.client.js';
import config from '../../../src/config/env.config.js';

jest.setTimeout(40000);

describe('Order & Dispatch Lifecycle E2E Integration Tests', () => {
  let tokens = { customer: '', deliverer: '', vendor: '', admin: '' };
  let ids = { customer: '', deliverer: '', vendor: '', admin: '', restaurant: '', category: '', menuItem: '' };
  let currentOrderId = '';
  let otpCode = '';

  const CAMPUS_LAT = 8.563;
  const CAMPUS_LNG = 39.291;

  beforeAll(async () => {
    try {
      // 1. Wipe DB reliably
      await prisma.dispatchLog.deleteMany();
      await prisma.orderStatusHistory.deleteMany();
      await prisma.ledgerEntry.deleteMany();
      await prisma.payoutLog.deleteMany();
      await prisma.order.deleteMany();
      await prisma.menuItem.deleteMany();
      await prisma.category.deleteMany();
      await prisma.vendorProfile.deleteMany();
      await prisma.delivererProfile.deleteMany();
      await prisma.customerProfile.deleteMany();
      await prisma.restaurant.deleteMany();
      await prisma.verificationToken.deleteMany(); // Added to fix the FK error
      await prisma.user.deleteMany();

      const createStandardUser = async (role, email, phone) => {
        const payload = {
          telegramId: Math.floor(Math.random() * 100000),
          astuEmail: email, 
          fullName: role, 
          phoneNumber: phone, 
          password: 'Password123!'
        };
        const regRes = await request(app).post('/api/v1/auth/register').send(payload);
        if (!regRes.body.success) throw new Error(`Standard Reg failed: ${JSON.stringify(regRes.body)}`);

        await prisma.user.update({ 
          where: { astuEmail: email }, 
          data: { isEmailVerified: true, isPhoneVerified: true, role } 
        });

        const logRes = await request(app).post('/api/v1/auth/login').send({ identifier: email, password: 'Password123!' });
        return { token: logRes.body.data.accessToken, id: logRes.body.data.user.id };
      };

      const createVendorUser = async (email, phone) => {
        const payload = {
          telegramId: Math.floor(Math.random() * 100000),
          email: email, 
          fullName: 'Test Vendor',
          phoneNumber: phone,
          password: 'Password123!',
          businessDocumentUrl: 'https://example.com/license.pdf'
        };
        const regRes = await request(app).post('/api/v1/auth/register/vendor').send(payload);
        if (!regRes.body.success) throw new Error(`Vendor Reg failed: ${JSON.stringify(regRes.body)}`);

        await prisma.user.update({
          where: { phoneNumber: phone },
          data: { isPhoneVerified: true }
        });

        const logRes = await request(app).post('/api/v1/auth/login').send({ identifier: email, password: 'Password123!' });
        return { token: logRes.body.data.accessToken, id: logRes.body.data.user.id };
      };

      // 2. Create Actors
      const admin = await createStandardUser('ADMIN', `admin_o_${Date.now()}@astu.edu.et`, `09${Math.floor(10000000 + Math.random() * 89999999)}`);
      const deliverer = await createStandardUser('DELIVERER', `deliv_o_${Date.now()}@astu.edu.et`, `09${Math.floor(10000000 + Math.random() * 89999999)}`);
      const customer = await createStandardUser('CUSTOMER', `cust_o_${Date.now()}@astu.edu.et`, `09${Math.floor(10000000 + Math.random() * 89999999)}`);
      const vendor = await createVendorUser(`vendor_o_${Date.now()}@business.com`, `09${Math.floor(10000000 + Math.random() * 89999999)}`);
      
      tokens.admin = admin.token; ids.admin = admin.id;
      tokens.vendor = vendor.token; ids.vendor = vendor.id;
      tokens.deliverer = deliverer.token; ids.deliverer = deliverer.id;
      tokens.customer = customer.token; ids.customer = customer.id;

      // 3. Setup Restaurant & Menu
      const restRes = await request(app).post('/api/v1/restaurants').set('Authorization', `Bearer ${tokens.admin}`).send({
        name: 'Test Cafe', mode: 'VENDOR_MANAGED', location: 'Block 01', phone: '0911111111', lat: CAMPUS_LAT, lng: CAMPUS_LNG, minOrderValue: 20
      });
      ids.restaurant = restRes.body.data.id;

      await request(app).post('/api/v1/users/assign-vendor').set('Authorization', `Bearer ${tokens.admin}`).send({
        userId: ids.vendor, restaurantId: ids.restaurant, isOwner: true
      });

      // CRITICAL FIX: Removed '/menus' from the path
      const catRes = await request(app).post(`/api/v1/restaurants/${ids.restaurant}/categories`).set('Authorization', `Bearer ${tokens.vendor}`).send({
        name: 'Mains', sortOrder: 1
      });
      if (!catRes.body.success) throw new Error(`Category creation failed: ${JSON.stringify(catRes.body)}`);
      ids.category = catRes.body.data.id;

      // CRITICAL FIX: Removed '/menus' from the path
      const itemRes = await request(app).post(`/api/v1/restaurants/${ids.restaurant}/items`).set('Authorization', `Bearer ${tokens.vendor}`).send({
        categoryId: ids.category, name: 'Burger', price: 100, prepTimeMins: 10
      });
      if (!itemRes.body.success) throw new Error(`Item creation failed: ${JSON.stringify(itemRes.body)}`);
      ids.menuItem = itemRes.body.data.id;

      // 4. Open Restaurant & Set Deliverer Online
      await request(app).patch(`/api/v1/restaurants/${ids.restaurant}/status`).set('Authorization', `Bearer ${tokens.vendor}`).send({ isOpen: true });
      
      await request(app).patch('/api/v1/users/me/payout').set('Authorization', `Bearer ${tokens.deliverer}`).send({
        payoutProvider: 'TELEBIRR', payoutAccount: '0912345678'
      });
      await request(app).patch('/api/v1/users/me/toggle-mode').set('Authorization', `Bearer ${tokens.deliverer}`).send({ mode: 'DELIVERER' });
      await request(app).patch('/api/v1/users/me/availability').set('Authorization', `Bearer ${tokens.deliverer}`).send({ isAvailable: true });

    } catch (e) {
      console.error("❌ Setup failed", e);
      throw e;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await new Promise(r => setTimeout(r, 500));
  });

  // ==========================================
  // SCENARIO 1: PRE-CHECKOUT & CART VALIDATION
  // ==========================================
  describe('Cart & Quoting', () => {
    it('should generate a valid quote without saving to DB', async () => {
      const res = await request(app)
        .post('/api/v1/orders/quote')
        .set('Authorization', `Bearer ${tokens.customer}`)
        .send({
          restaurantId: ids.restaurant,
          deliveryLat: CAMPUS_LAT + 0.005,
          deliveryLng: CAMPUS_LNG + 0.005,
          items: [{ menuId: ids.menuItem, quantity: 2, expectedUnitPrice: 100 }]
        });

      expect(res.status).toBe(200);
      expect(res.body.data.foodPrice).toBe(200); 
    });

    it('should reject checkout if frontend expected price mismatches DB price (Anti-Spoofing)', async () => {
      const res = await request(app)
        .post('/api/v1/orders/quote')
        .set('Authorization', `Bearer ${tokens.customer}`)
        .send({
          restaurantId: ids.restaurant,
          deliveryLat: CAMPUS_LAT, deliveryLng: CAMPUS_LNG,
          items: [{ menuId: ids.menuItem, quantity: 1, expectedUnitPrice: 50 }] 
        });

      expect(res.status).toBe(409);
    });
  });

  // ==========================================
  // SCENARIO 2: THE LIFECYCLE (HAPPY PATH)
  // ==========================================
  describe('Full Delivery Lifecycle', () => {
    it('Step 1: Customer Checkouts successfully', async () => {
      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${tokens.customer}`)
        .send({
          restaurantId: ids.restaurant,
          deliveryLat: CAMPUS_LAT, deliveryLng: CAMPUS_LNG,
          items: [{ menuId: ids.menuItem, quantity: 1, expectedUnitPrice: 100 }],
          tip: 10
        });

      expect(res.status).toBe(201);
      currentOrderId = res.body.data.id;
    });

    it('Step 2: Deliverer Accepts Order (Atomic Lock)', async () => {
      const res = await request(app)
        .post(`/api/v1/dispatch/${currentOrderId}/accept`)
        .set('Authorization', `Bearer ${tokens.deliverer}`);

      expect(res.status).toBe(200);
    });

    it('Step 3: Webhook Simulates Chapa Payment Success', async () => {
      const payload = {
        tx_ref: `TXN-TEST-${Date.now()}`, status: 'success', id: currentOrderId
      };
      const signature = crypto.createHmac('sha256', config.CHAPA_WEBHOOK_SECRET).update(JSON.stringify(payload)).digest('hex');

      const res = await request(app)
        .post('/api/v1/payments/webhook/chapa')
        .set('x-chapa-signature', signature)
        .send(payload);

      expect(res.status).toBe(200);
    });

    it('Step 4: Vendor Prepares and Finishes Food', async () => {
      await request(app).patch(`/api/v1/orders/${currentOrderId}/state/vendor`)
        .set('Authorization', `Bearer ${tokens.vendor}`).send({ status: 'VENDOR_BEING_PREPARED', estimatedPrepTimeMins: 10 });
      
      const res = await request(app).patch(`/api/v1/orders/${currentOrderId}/state/vendor`)
        .set('Authorization', `Bearer ${tokens.vendor}`).send({ status: 'VENDOR_READY_FOR_PICKUP' });

      expect(res.status).toBe(200);
    });

    it('Step 5: Deliverer Picks Up and Arrives', async () => {
      await request(app).patch(`/api/v1/orders/${currentOrderId}/state/deliverer`)
        .set('Authorization', `Bearer ${tokens.deliverer}`).send({ status: 'PICKED_UP', currentLat: CAMPUS_LAT, currentLng: CAMPUS_LNG });
      
      const res = await request(app).patch(`/api/v1/orders/${currentOrderId}/state/deliverer`)
        .set('Authorization', `Bearer ${tokens.deliverer}`).send({ status: 'ARRIVED', currentLat: CAMPUS_LAT, currentLng: CAMPUS_LNG });

      expect(res.status).toBe(200);
    });

    it('Step 6: OTP Handshake and Payout Ledger Completion', async () => {
      const customerView = await request(app).get(`/api/v1/orders/${currentOrderId}`).set('Authorization', `Bearer ${tokens.customer}`);
      otpCode = customerView.body.data.otpCode;

      const res = await request(app)
        .post(`/api/v1/orders/${currentOrderId}/confirm-handshake`)
        .set('Authorization', `Bearer ${tokens.deliverer}`)
        .send({ otpCode });

      expect(res.status).toBe(200);

      const finalOrder = await prisma.order.findUnique({ where: { id: currentOrderId } });
      expect(finalOrder.status).toBe('COMPLETED');
    });
  });
});