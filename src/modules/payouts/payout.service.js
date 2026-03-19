import { triggerMobileMoneyPayout } from '../../infrastructure/payment/payout.adapter.js';
import { LedgerService } from '../ledger/ledger.service.js';
import prisma from '../../infrastructure/database/prisma.client.js';

export class PayoutService {
  constructor() {
    this.ledgerService = new LedgerService();
  }

  async executeDelivererPayout(order) {
    // 1. Trigger the actual money transfer
    const payoutResult = await triggerMobileMoneyPayout(
      order.deliverer.payoutAccount,
      order.payoutAmount,
      `PAYOUT-${order.id}`
    );

    if (payoutResult.success) {
      // 2. Record the payment in the Ledger within a transaction
      await prisma.$transaction(async (tx) => {
        await this.ledgerService.processFinancialEvent(
          order,
          'REIMBURSEMENT_PAYMENT',
          order.payoutAmount,
          order.assignedDelivererId,
          tx
        );
      });
    }
    
    return payoutResult;
  }
}