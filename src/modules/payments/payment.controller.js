import { PaymentService } from "./payment.service.js";
import { ChapaAdapter } from "../../infrastructure/payment/chapa.adapter.js";

export const paymentService = new PaymentService();

export const initialize = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    // Extract user email/name from the JWT token payload attached by protect middleware
    const userEmail = req.user.email || req.user.astuEmail || 'customer@astu.edu.et';
    const userFullName = req.user.fullName || 'Customer';

    const checkout_url = await paymentService.initializePayment(req.user.id, userEmail, userFullName, orderId);
    res.status(200).json({ success: true, data: { checkoutUrl: checkout_url } });
  } catch (error) {
    next(error);
  }
};

export const chapaWebhook = async (req, res, next) => {
  try {
    // FIX: Correct spelling of 'signature'
    const signature = req.headers['x-chapa-signature'];

    // must be uncommented in production
    if (!ChapaAdapter.verifyWebhookSignature(signature, req.body)) {
      return res.status(401).send('Invalid signature');
    }

    const { tx_ref, status } = req.body;
    console.log('Webhook infooooooooooooooooooooo');
    

    if (status === 'success') {
      await paymentService.handlePaymentSuccess(tx_ref);
    }

    // Always return 200 OK so Chapa doesn't retry endlessly
    res.status(200).send('Webhook Received');
  } catch (error) {
    console.error('🔥 [WEBHOOK CRASH]', error);
    // Even on internal failure, return 200 to Chapa to prevent webhook flooding,
    // we log the error internally for manual review.
    res.status(200).send('Webhook Received but processing failed');
  }
};