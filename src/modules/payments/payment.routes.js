import { Router } from 'express';
import * as paymentController from './payment.controller.js';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { validate } from '../../api/middlewares/validate.middleware.js';
import { initializePaymentSchema } from './payment.dto.js';

const router = Router();

// ==========================================
// INTERNAL APP ROUTES (Requires Auth)
// ==========================================
router.post(
  '/initialize', 
  protect,  
  validate(initializePaymentSchema), 
  paymentController.initialize
);

// ==========================================
// EXTERNAL WEBHOOKS (Public, secured by Cryptographic Signature)
// ==========================================
router.post('/webhook/chapa', paymentController.chapaWebhook);

export default router;