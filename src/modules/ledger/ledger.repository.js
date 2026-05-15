import prisma from '../../infrastructure/database/prisma.client.js';

export class LedgerRepository {
  /**
   * Appends an entry to the immutable ledger.
   * tx is an optional Prisma transaction client.
   */
  async createEntry(data, tx = prisma) {
    return await tx.ledgerEntry.create({
      data: {
        orderId: data.orderId,
        userId: data.userId,
        amount: data.amount,
        type: data.type, // ESCROW_RESERVE, REIMBURSEMENT_PAYMENT, etc.
        status: 'COMPLETED',
        reference: data.reference || null, 
        transferRef: data.reference
      }
    });
  }
}