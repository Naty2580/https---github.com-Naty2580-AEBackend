import { LedgerService } from '../ledger/ledger.service.js';
import { PayoutRepository } from './payout.repository.js';
import { ChapaAdapter } from '../../infrastructure/payment/chapa.adapter.js'; // USE CHAPA ADAPTER
import crypto from 'node:crypto';

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
      where: { id: order.delivererId },
      include: { user: { select: { fullName: true } } }
    });

    console.log("del", deliverer);

    if (!deliverer || !deliverer.payoutAccount) {
      await this.payoutRepository.logAttempt(order.id, 'FAILED', 'Missing payout account');
      throw new Error('Deliverer has no payout account configured.');
    }

    try {
      // 3. Trigger External API (Telebirr/CBE)
      // const payoutResult = await triggerMobileMoneyPayout(
      //   deliverer.payoutAccount,
      //   order.payoutAmount,
      //   `PAYOUT-${order.id}`
      // );

      //     if (payoutResult.success) {
      //   // 4. Record Success in DB
      //   await this.payoutRepository.logAttempt(order.id, 'SUCCESS', JSON.stringify(payoutResult));

      //   // 5. Update Ledger (Double Entry)
      //   await this.ledgerService.processFinancialEvent(
      //     order, 'REIMBURSEMENT_PAYMENT', order.payoutAmount, order.delivererId, txClient
      //   );

      //   if (Number(order.serviceFee) > 0) {
      //     await this.ledgerService.processFinancialEvent(
      //       order, 'PLATFORM_REVENUE', order.serviceFee, null, txClient // null userId means it belongs to the System
      //     );
      //   }
      // } else {
      //   throw new Error('Mobile Money API rejected the transaction');
      // }


         const transferRef = `AE-PAYOUT-${crypto.randomBytes(4).toString('hex')}`;
      
      const payoutData = {
        account_name: deliverer.user.fullName,
        account_number: deliverer.payoutAccount,
        amount: "50.0",
        // amount: Number(order.payoutAmount).toString(),
        currency: 'ETB',
        reference: transferRef,
        bank_code: deliverer.payoutProvider, // Make sure DB stores 'telebirr' or CBE code
      };
      // const payoutResult = await ChapaAdapter.transferFunds(payoutData);

      // mock payout result for testing without hitting real API
      const payoutResult = {
        "message": "Transfer Queued Successfully",
        "status": "success",
        "data": `bb${crypto.randomBytes(8).toString('hex')}`
      }

      // Record Success and Ledger
      await this.payoutRepository.logAttempt(order.id, 'SUCCESS', JSON.stringify(payoutResult));
      await this.ledgerService.processFinancialEvent(
        order, 'REIMBURSEMENT_PAYMENT', order.payoutAmount = 120, order.delivererId, txClient, transferRef
        // order, 'REIMBURSEMENT_PAYMENT', order.payoutAmount, order.delivererId, txClient
      ); 

      if (Number(order.serviceFee) > 0) { 
        const revRef = `AE-REV-${crypto.randomUUID()}`;
        await this.ledgerService.processFinancialEvent(
          order, 'PLATFORM_REVENUE', order.serviceFee, null, txClient,revRefl //erId means it belongs to the System, 
        );
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