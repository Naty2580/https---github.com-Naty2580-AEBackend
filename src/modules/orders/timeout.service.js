import prisma from '../../infrastructure/database/prisma.client.js';
import { LedgerService } from '../ledger/ledger.service.js'; 

export class OrderTimeoutService {
    constructor() {
    this.ledgerService = new LedgerService();
  }

  /**
   * Schedules a 5-minute timeout for the Customer to complete the Chapa payment.
   * If unpaid, the order is cancelled, and the deliverer is freed.
   */
   schedulePaymentTimeout(orderId, customerId) {
    const TIMEOUT_MS = 5 * 60 * 1000;

    setTimeout(async () => {
      try {
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          select: { status: true }
        });

        if (order && order.status === 'ASSIGNED') {
          console.log(`⏳ [TIMEOUT] Order ${orderId} unpaid. Cancelling...`);
          
          await prisma.$transaction([
            prisma.order.update({
              where: { id: orderId, status: 'ASSIGNED' }, // OCC check
              data: { status: 'CANCELLED' }
            }),
            prisma.orderStatusHistory.create({
              data: { orderId, newStatus: 'CANCELLED', changedById: customerId }
            })
          ]);
        }
      } catch (error) {
        if (error.code !== 'P2025') console.error(`🔥 [TIMEOUT ERROR]:`, error);
      }
    }, TIMEOUT_MS);
  }

 scheduleBroadcastTimeout(orderId, customerId) {
    const TIMEOUT_MS = 15 * 60 * 1000;

    setTimeout(async () => {
      try {
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          select: { status: true, paymentStatus: true, totalAmount: true, customerId: true }
        });

        if (order && order.status === 'AWAITING_ACCEPT') {
          console.log(`⏳ [TIMEOUT] Order ${orderId} unaccepted. Refunding...`);
          
          await prisma.$transaction([
            prisma.order.update({
              where: { id: orderId, status: 'AWAITING_ACCEPT' },
              data: { status: 'NO_DELIVERER_FOUND' }
            }),
            prisma.orderStatusHistory.create({
              data: { orderId, newStatus: 'NO_DELIVERER_FOUND', changedById: customerId }
            })
          ]);

          // Escrow Reversal (If they somehow pre-paid, though current flow is accept -> pay)
          if (order.paymentStatus === 'CAPTURED') {
            await this.ledgerService.processFinancialEvent(
              order, 'REFUND', order.totalAmount, order.customerId
            );
          }
        }
      } catch (error) {
        if (error.code !== 'P2025') console.error(`🔥 [TIMEOUT ERROR]:`, error);
      }
    }, TIMEOUT_MS);
  }


  /**
   * Reconciliation Sweep (Runs on server startup to catch orders that were
   * in ASSIGNED state when the server crashed/restarted).
   */
  async sweepOrphanedOrders() {
    console.log('🧹 Sweeping orphaned unpaid orders...');
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);

    const orphanedOrders = await prisma.order.findMany({
      where: {
        status: 'ASSIGNED',
        updatedAt: { lte: fiveMinsAgo }
      },
      select: { id: true, customerId: true }
    });

    if (orphanedOrders.length > 0) {
      for (const order of orphanedOrders) {
        await prisma.$transaction([
          prisma.order.update({
            where: { id: order.id },
            data: { status: 'CANCELLED' }
          }),
          prisma.orderStatusHistory.create({
            data: { orderId: order.id, newStatus: 'CANCELLED', changedById: order.customerId }
          })
        ]);
      }
      console.log(`✅ Freed ${orphanedOrders.length} deliverers from orphaned orders.`);
    }
  }
}

export const timeoutService = new OrderTimeoutService();