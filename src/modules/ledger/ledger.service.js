import { LedgerRepository } from './ledger.repository.js';

export class LedgerService {
  constructor() {
    this.repository = new LedgerRepository();
  }

  /**
   * Records financial movements within an existing Prisma transaction.
   * This is called by the OrderService during state transitions.
   */
  async processFinancialEvent(order, type, amount, userId, tx) {
    // Audit rule: All financial movement must link to a valid order and amount
    if (amount <= 0) throw new Error("Ledger entries must have a positive amount.");

    return await this.repository.createEntry({
      orderId: order.id,
      userId: userId,
      amount: amount,
      type: type,
      reference: order.chapaRef || order.payoutRef
    }, tx);
  }
}