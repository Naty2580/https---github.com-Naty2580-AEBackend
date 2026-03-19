import { Router } from 'express';
import { verifyChapaSignature } from '../../infrastructure/payment/chapa.adapter.js';
import { PaymentService } from './payment.service.js';

const router = Router();
const paymentService = new PaymentService();

router.post('/webhook/chapa', async (req, res) => {
  const signature = req.headers['x-chapa-signature'];
  if (!verifyChapaSignature(signature, req.body)) {
    return res.status(401).send('Invalid signature');
  }

  const { tx_ref, status } = req.body;
  if (status === 'success') {
    await paymentService.handlePaymentSuccess(req.body.id, tx_ref);
  }

  res.status(200).send('Webhook Received');
});

export default router;