import { LedgerRepository } from './ledger.repository.js';
import prisma from '../../infrastructure/database/prisma.client.js';
import crypto from 'node:crypto';

export class LedgerService {
  constructor() {
    this.repository = new LedgerRepository();
  }

  /**
   * Records financial movements within an existing Prisma transaction.
   * This is called by the OrderService during state transitions.
   */
  async processFinancialEvent(order, type, amount, profileId,txClient = prisma, uniqueRef) {
    // Audit rule: All financial movement must link to a valid order and amount
    if (amount <= 0) throw new Error("Ledger entries must have a positive amount.");

    const referenceString = uniqueRef || `AE-LEDG-${crypto.randomUUID()}`;

    const userId = await prisma.delivererProfile.findUnique({
      where: { id: profileId },
      select: { userId: true }
    }).then(profile => profile?.userId);


    return await this.repository.createEntry({
      orderId: order.id,
      userId: userId,
      amount: amount,
      type: type,
      reference: referenceString
    }, txClient);
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
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 50;
    const skip = (page - 1) * limit;

    const [total, transactions, aggregations, pendingPayouts] = await prisma.$transaction([
      // 1. Total count for pagination
      prisma.ledgerEntry.count(),
      
      // 2. Fetch actual transactions
      prisma.ledgerEntry.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          order: {
            select: { shortId: true, status: true }
          },
          user: {
            select: { fullName: true, role: true }
          }
        }
      }),
      
      // 3. Aggregate COMPLETED amounts by type
      prisma.ledgerEntry.groupBy({
        by: ['type'],
        _sum: { amount: true },
        where: { status: 'COMPLETED' }
      }),
      
      // 4. Aggregate PENDING Reimbursements
      prisma.ledgerEntry.aggregate({
        _sum: { amount: true },
        where: { type: 'REIMBURSEMENT_PAYMENT', status: 'PENDING' }
      })
    ]);

    const summary = {
      totalEscrow: 0,
      platformRevenue: 0,
      pendingPayouts: Number(pendingPayouts._sum.amount || 0),
      totalRefunds: 0
    };

    aggregations.forEach(agg => {
      const amount = Number(agg._sum.amount || 0);
      if (agg.type === 'ESCROW_RESERVE') summary.totalEscrow += amount;
      if (agg.type === 'PLATFORM_REVENUE') summary.platformRevenue += amount;
      if (agg.type === 'REFUND') summary.totalRefunds += amount;
    });

    const formattedTransactions = transactions.map(t => ({
      ...t,
      amount: Number(t.amount || 0)
    }));

    return { 
      total, 
      summary, 
      transactions: formattedTransactions 
    };
  }
  
}