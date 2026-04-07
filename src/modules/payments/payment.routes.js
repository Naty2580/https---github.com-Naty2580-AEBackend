import { Router } from 'express';
import { PaymentController } from './payment.controller.js';
import {protect} from '../../api/middlewares/auth.middleware.js'

const router = Router();
const PaymentController = new PaymentController();

router.post('/initialize', /* requireAuth */ protect, PaymentController.initialize)

router.post('/webhook/chapa', PaymentController.chapaWebhook)

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