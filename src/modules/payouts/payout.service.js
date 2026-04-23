import { triggerMobileMoneyPayout } from '../../infrastructure/payment/payout.adapter.js';
import { LedgerService } from '../ledger/ledger.service.js';
import prisma from '../../infrastructure/database/prisma.client.js';
import { PayoutRepository } from './payout.repository.js';

export class PayoutService {
  constructor() {
    this.ledgerService = new LedgerService();
    this.payoutRepository = new PayoutRepository();
  }

  async executeDelivererPayout(order, txClient = prisma) {
    // 1. Idempotency Check: Ensure we haven't already paid this deliverer
    const existingLog = await this.payoutRepository.getLogByOrderId(order.id);
    if (existingLog && existingLog.status === 'SUCCESS') {
      console.warn(`[PAYOUT] Order ${order.id} was already paid out. Ignoring duplicate call.`);
      return;
    }

    // 2. Fetch Deliverer Payout Details
    // Depending on the query depth from the OrderService, we might need to fetch the profile
    const deliverer = await txClient.delivererProfile.findUnique({
      where: { userId: order.assignedDelivererId }
    });

    if (!deliverer || !deliverer.payoutAccount) {
      await this.payoutRepository.logAttempt(order.id, 'FAILED', 'Missing payout account');
      throw new Error('Deliverer has no payout account configured.');
    }

    try {
      // 3. Trigger External API (Telebirr/CBE)
      const payoutResult = await triggerMobileMoneyPayout(
        deliverer.payoutAccount,
        order.payoutAmount,
        `PAYOUT-${order.id}`
      );

      if (payoutResult.success) {
        // 4. Record Success in DB
        await this.payoutRepository.logAttempt(order.id, 'SUCCESS', JSON.stringify(payoutResult));

        // 5. Update Ledger (Double Entry)
        await this.ledgerService.processFinancialEvent(
          order, 'REIMBURSEMENT_PAYMENT', order.payoutAmount, order.assignedDelivererId, txClient
        );
      } else {
        throw new Error('Mobile Money API rejected the transaction');
      }

    } catch (error) {
      // 6. Record Failure
      await this.payoutRepository.logAttempt(order.id, 'FAILED', error.message);
      console.error(`🔥 [PAYOUT CRASH] Order ${order.id}:`, error.message);
      
      // Note: We do NOT throw the error here. If the payout fails, we still want the order
      // to transition to COMPLETED so the customer's UI finishes. The Admin will use the 
      // Retry endpoint to fix the broken payout later.
    }
  }
}