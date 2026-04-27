import prisma from '../../infrastructure/database/prisma.client.js';
import { calculateDistance } from '../../core/utils/pricing.utils.js';

export class FraudDetectionService {
  
  /**
   * Rule 1: Flag customers with >= 3 refunds in a 7-day window.
   * Triggered upon Order Cancellation.
   */
  async checkRefundAbuse(customerId) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentRefunds = await prisma.ledgerEntry.count({
      where: {
        userId: customerId,
        type: 'REFUND',
        createdAt: { gte: sevenDaysAgo }
      }
    });

    if (recentRefunds >= 3) {
      await prisma.anomalyFlag.create({
        data: {
          userId: customerId,
          reason: 'EXCESSIVE_REFUNDS',
          severity: 'HIGH'
        }
      });
      console.warn(`🚨 [FRAUD] Customer ${customerId} flagged for excessive refunds.`);
    }
  }

  /**
   * Rule 2: Flag Deliverer if they drop/decline > 30% of accepted orders.
   * Triggered when a Deliverer drops an order.
   */
  async checkDelivererCancelRate(delivererId) {
    const logs = await prisma.dispatchLog.groupBy({
      by: ['action'],
      where: { delivererId },
      _count: { action: true }
    });

    let accepted = 0, declined = 0;
    logs.forEach(log => {
      if (log.action === 'ACCEPTED') accepted = log._count.action;
      if (log.action === 'DECLINED') declined = log._count.action;
    });

    const totalInvolvements = accepted + declined;
    if (totalInvolvements >= 5) { // Minimum threshold to calculate percentage
      const dropRate = declined / totalInvolvements;
      if (dropRate >= 0.30) {
        await prisma.anomalyFlag.create({
          data: {
            userId: delivererId,
            reason: 'HIGH_CANCEL_RATE',
            severity: 'MEDIUM'
          }
        });
        console.warn(`🚨 [FRAUD] Deliverer ${delivererId} flagged for 30%+ drop rate.`);
      }
    }
  }

  /**
   * Rule 3: Flag if Deliverer marks PICKED_UP while physically > 300m away from Vendor.
   */
  async checkGPSMismatch(orderId, delivererLat, delivererLng) {
    if (!delivererLat || !delivererLng) return;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { restaurant: true }
    });

    const distance = calculateDistance(
      order.restaurant.lat, order.restaurant.lng, 
      delivererLat, delivererLng
    );

    // If Deliverer claims to pick up food, but is > 300 meters away from the restaurant
    if (distance > 300) {
      await prisma.anomalyFlag.create({
        data: {
          orderId,
          userId: order.assignedDelivererId,
          reason: 'GPS_MISMATCH',
          severity: 'HIGH'
        }
      });
      console.warn(`🚨 [FRAUD] Order ${orderId} PICKED_UP GPS mismatch (${Math.round(distance)}m).`);
    }
  }
}

export const fraudService = new FraudDetectionService();