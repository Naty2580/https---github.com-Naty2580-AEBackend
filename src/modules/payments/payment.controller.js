import { PaymentService } from "./payment.service.js";
import { ChapaAdapter } from "../../infrastructure/payment/chapa.adapter.js";
import prisma from '../../infrastructure/database/prisma.client.js';


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
    // const signature = req.headers['x-chapa-signature'];

    // must be uncommented in production
    // if (!ChapaAdapter.verifyWebhookSignature(signature, req.body)) {
    //   return res.status(401).send('Invalid signature');
    // }

    const { tx_ref, status } = req.body;

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


// NEW: Development Simulation Endpoint
export const simulateWebhookDev = async (req, res, next) => {
  try {
    // 1. Extreme Security Guard: Never run this in production
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, message: 'Forbidden in production' });
    }

    const { orderId } = req.body;

    // 2. Fetch the order to find the chapaRef generated during initialization
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { chapaRef: true, status: true }
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    
    if (order.status !== 'ASSIGNED' && order.status !== 'AWAITING_PAYMENT') {
      return res.status(400).json({ success: false, message: `Order is in state: ${order.status}` });
    }

    if (!order.chapaRef) {
      return res.status(400).json({ success: false, message: 'You must click Pay with Chapa to generate a chapaRef first.' });
    }

    // 3. Directly call the internal service method, bypassing the HTTP webhook signature
    await paymentService.handlePaymentSuccess(order.chapaRef);

    res.status(200).json({ success: true, message: 'Dev Webhook Simulated Successfully' });
  } catch (error) {
    next(error);
  }
};