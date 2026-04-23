import prisma from '../../infrastructure/database/prisma.client.js';
import { LedgerService } from '../ledger/ledger.service.js';

export class PaymentService {
  constructor() {
    this.ledgerService = new LedgerService();
  }

   async handlePaymentSuccess(chapaRef, orderId) {
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Lock the order row to prevent simultaneous cancellation
        const [order] = await tx.$queryRaw`
          SELECT id, status, "paymentStatus", "totalAmount", "customerId" 
          FROM "Order" 
          WHERE id = ${orderId}::uuid 
          FOR UPDATE;
        `;

        if (!order) {
          console.error(`[WEBHOOK ERROR] Order ${orderId} not found.`);
          return;
        }

        // 2. Idempotency Check (Webhook arrived twice)
        if (order.paymentStatus === 'CAPTURED') {
          console.log(`[WEBHOOK] Order ${orderId} already captured. Ignoring.`);
          return; 
        }

        // 3. The Phantom Cancellation Edge Case
        if (order.status === 'CANCELLED') {
          console.warn(`[WEBHOOK CONFLICT] Order ${orderId} was cancelled before webhook arrived. Triggering automatic refund sequence.`);
          
          // Update payment status to show we received it, but keep order CANCELLED
          await tx.order.update({
            where: { id: orderId },
            data: { paymentStatus: 'REFUNDED', chapaRef }
          });

          // Ledger Accounting: Money came in (Reserve), but must immediately go out (Refund)
          await this.ledgerService.processFinancialEvent(
            order, 'ESCROW_RESERVE', order.totalAmount, order.customerId, tx
          );
          await this.ledgerService.processFinancialEvent(
            order, 'REFUND', order.totalAmount, order.customerId, tx
          );
          
          return;
        }

        // 4. Normal Happy Path
        if (order.status !== 'AWAITING_PAYMENT') {
          // This should never happen unless a Deliverer bypassed state
          console.error(`[WEBHOOK ERROR] Order ${orderId} is in illegal state ${order.status}.`);
          throw new Error('ILLEGAL_STATE');
        }

        // Update status to PAYMENT_RECEIVED
        const updated = await tx.order.update({
          where: { id: orderId },
          data: { status: 'PAYMENT_RECEIVED', paymentStatus: 'CAPTURED', chapaRef }
        });

        await tx.orderStatusHistory.create({
          data: { orderId, newStatus: 'PAYMENT_RECEIVED', changedById: order.customerId }
        });

        // Trigger Escrow
        await this.ledgerService.processFinancialEvent(
          updated, 'ESCROW_RESERVE', updated.totalAmount, updated.customerId, tx
        );
      });
    } catch (error) {
      console.error(`🔥 [WEBHOOK FAILURE] Order ${orderId}:`, error);
      throw error;
    }
  }

   async initializePayment(customerId, orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: { include: { user: true } } }
    });

    if (!order) throw new NotFoundError('Order not found.');
    if (order.customerId !== customerId) throw new ForbiddenError('Unauthorized access to this order.');
    if (order.status !== 'ASSIGNED') throw new BusinessLogicError('Order is not ready for payment. Waiting for a deliverer to accept.');
    if (order.paymentStatus !== 'AWAITING_PAYMENT') throw new BusinessLogicError('Payment has already been processed or cancelled.');

    // Prepare Chapa Payload
    const payload = {
      amount: Number(order.totalAmount).toString(),
      currency: "ETB",
      email: order.customer.user.email || order.customer.user.astuEmail,
      first_name: order.customer.user.fullName,
      last_name: "ASTU", // Placeholder if single name provided
      phone_number: order.customer.user.phoneNumber,
      tx_ref: `TXN-${order.shortId}-${Date.now()}`,
      callback_url: `${config.FRONTEND_URL}/orders/${order.id}/success`, // Redirect customer here after payment
      return_url: `${config.FRONTEND_URL}/orders/${order.id}/success`,
      "customization[title]": "ASTU Eats Delivery",
      "customization[description]": `Payment for order ${order.shortId}`
    };

    try {
      // In a real production system, this calls the Chapa API.
      // For this implementation, we simulate the API call to avoid breaking the local dev environment.
      
      /* Real Implementation:
      const response = await axios.post('https://api.chapa.co/v1/transaction/initialize', payload, {
        headers: { Authorization: `Bearer ${config.CHAPA_SECRET_KEY}` }
      });
      return response.data.data.checkout_url;
      */

      console.log(`[PAYMENT SIMULATION] Initializing Chapa checkout for ${payload.amount} ETB. Ref: ${payload.tx_ref}`);
      
      // Simulate Chapa returning a checkout URL
      return `https://checkout.chapa.co/checkout/payment/${payload.tx_ref}`;

    } catch (error) {
      console.error('Chapa Initialization Error:', error.response?.data || error.message);
      throw new Error('Failed to initialize payment gateway.');
    }
  }

  
}