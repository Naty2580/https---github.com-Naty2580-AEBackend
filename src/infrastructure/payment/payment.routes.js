import { Router } from 'express';
import { verifyChapaSignature } from '../../infrastructure/payment/chapa.adapter.js';
import { PaymentService } from './payment.service.js';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import * as paymentController from './payment.controller.js';

const router = Router();

// 1. Webhook (Public)
router.post('/webhook/chapa', async (req, res) => {
  // ... existing webhook logic
});

// 2. NEW: Customer Payment Initialization
router.post(
  '/:orderId/initiate',
  protect,
  restrictTo('CUSTOMER', 'ADMIN'),
  paymentController.initiate
);

export default router;