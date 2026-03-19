import prisma from '../../infrastructure/database/prisma.client.js';
import { LedgerService } from '../ledger/ledger.service.js';

export class PaymentService {
  constructor() {
    this.ledgerService = new LedgerService();
  }

  async handlePaymentSuccess(chapaRef, orderId) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      
      // Idempotency check
      if (order.status === 'PAYMENT_RECEIVED') return;

      // 1. Transition Order Status
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'PAYMENT_RECEIVED', paymentStatus: 'CAPTURED', chapaRef }
      });

      // 2. Trigger Ledger entry (The Escrow Reserve)
      await this.ledgerService.processFinancialEvent(
        order, 
        'ESCROW_RESERVE', 
        order.totalAmount, 
        order.customerId, 
        tx
      );
    });
  }
}