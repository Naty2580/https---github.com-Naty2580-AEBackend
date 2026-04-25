import { Router } from 'express';
import { PaymentController } from './payment.controller.js';
import {protect} from '../../api/middlewares/auth.middleware.js'

const router = Router();
const paymentController = new PaymentController();

/**
 * @openapi
 * /payments/initialize:
 *   post:
 *     summary: Initialize a new Chapa Payment Session
 *     description: Returns a checkout URL for the customer to finalize payment via Chapa.
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: The unique ID of the order being paid for
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Successfully initialized transaction
 *       400:
 *         description: Order not found or not in payable state
 */
router.post('/initialize', protect, paymentController.initialize)

router.post('/webhook/chapa', paymentController.chapaWebhook)

// router.post('/webhook/chapa', async (req, res) => {
//   const signature = req.headers['x-chapa-signature'];
//   if (!verifyChapaSignature(signature, req.body)) {
//     return res.status(401).send('Invalid signature');
//   }

//   const { tx_ref, status } = req.body;
//   if (status === 'success') {
//     await paymentService.handlePaymentSuccess(req.body.id, tx_ref);
//   }

//   res.status(200).send('Webhook Received');
// });

export default router;