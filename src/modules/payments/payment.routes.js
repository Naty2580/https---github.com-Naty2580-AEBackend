import { Router } from 'express';
import { verifyChapaSignature } from '../../infrastructure/payment/chapa.adapter.js';
import { PaymentService } from './payment.service.js';
import * as paymentController from './payment.controller.js';
import { protect } from '../../api/middlewares/auth.middleware.js'

const router = Router();
const paymentService = new PaymentService();

// ==========================================
// INTERNAL APP ROUTES (Requires Auth)
// ==========================================

/**
 * @openapi
 * /payments/initialize:
 *   post:
 *     summary: Initialize a new Chapa Payment Session
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId]
 *             properties:
 *               orderId: { type: string, format: uuid, example: "123e4567-e89b-12d3-a456-426614174000" }
 *     responses:
 *       200: { description: Successfully initialized transaction }
 */
router.post('/initialize', protect, paymentController.initiateCheckout);

// ==========================================
// EXTERNAL WEBHOOKS (Public, secured by Cryptographic Signature)
// ==========================================

router.post('/webhook/chapa', async (req, res) => {
  const signature = req.headers['x-chapa-signature'];
  if (!verifyChapaSignature(signature, req.body)) {
    return res.status(401).send('Invalid signature');
  }

  const { tx_ref, status } = req.body;
  if (status === 'success') {
    await paymentService.handlePaymentSuccess(tx_ref, req.body.id);
  }

  res.status(200).send('Webhook Received');
});

export default router;