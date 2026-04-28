import prisma from '../../infrastructure/database/prisma.client.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { initiateChapaPayment } from '../../infrastructure/payment/chapa.adapter.js';
import { NotFoundError, ForbiddenError, BusinessLogicError } from '../../core/errors/domain.errors.js';

export class PaymentService {
  constructor() {
    this.ledgerService = new LedgerService();
  }

  /**
   * NEW: Called by the Customer to get the payment URL
   */
  async initiatePayment(customerId, orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: { include: { user: { select: { fullName: true, astuEmail: true } } } } }
    });

    if (!order) throw new NotFoundError('Order not found');
    if (order.customerId !== customerId) throw new ForbiddenError('Unauthorized access');
    
    // Strict State Check: Payment can only be initiated if a Deliverer accepted it
    if (order.status !== 'ASSIGNED') {
      throw new BusinessLogicError(`Cannot initiate payment for order in ${order.status} state.`);
    }

    // Call Chapa Adapter
    const chapaResponse = await initiateChapaPayment({
      amount: order.totalAmount,
      shortId: order.shortId,
      email: order.customer.user.astuEmail,
      name: order.customer.user.fullName
    });

    // Update Order with the generated tx_ref so the webhook can match it later
    await prisma.order.update({
      where: { id: orderId },
      data: { chapaRef: chapaResponse.tx_ref }
    });

    return chapaResponse;
  }

  // ... keep handlePaymentSuccess (Webhook logic)
}