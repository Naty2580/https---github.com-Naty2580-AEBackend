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

  async getUserLedger(userId, query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [total, entries, aggregations] = await prisma.$transaction([
      prisma.ledgerEntry.count({ where: { userId, type: 'REIMBURSEMENT_PAYMENT', status: 'COMPLETED' } }),
      prisma.ledgerEntry.findMany({
        where: { userId, type: 'REIMBURSEMENT_PAYMENT', status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        skip, take: limit
      }),
      prisma.ledgerEntry.aggregate({
        where: { userId, type: 'REIMBURSEMENT_PAYMENT', status: 'COMPLETED' },
        _sum: { amount: true }
      })
    ]);

    return { 
      totalEarnings: aggregations._sum.amount || 0,
      total, 
      entries 
    };
  }

  async getPlatformLedger(query) {
    // Similar to above, but querying PLATFORM_REVENUE where userId = null
    // Implementation omitted for brevity, follows same pattern
    return { platformRevenue: 0, entries: [] }; 
  }
  
}