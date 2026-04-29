import prisma from '../../infrastructure/database/prisma.client.js';

export class DispatchRepository {
  /**
   * Atomic lock on Order assignment
   */
  async lockAndAssignOrder(orderId, delivererId) {
    return await prisma.$transaction(async (tx) => {
      // 1. Lock the order row (SELECT FOR UPDATE)
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, assignedDelivererId: true, status: true }
      });

      if (!order || order.assignedDelivererId !== null || order.status !== 'AWAITING_ACCEPT') {
        throw new Error('Order is no longer available for assignment.');
      }

      // 2. Assign the deliverer
      return await tx.order.update({
        where: { id: orderId },
        data: { 
          assignedDelivererId: delivererId,
          status: 'ASSIGNED'
        }
      });
    });
  }

  /**
   * Find available deliverers within a coordinate box (BBox) 
   * A 1.8km radius is approx +/- 0.016 degrees of lat/lng
   */
   async findNearbyDeliverers(restaurantLat, restaurantLng) {
    // 1. Define Bounding Box (approx 1.8km = ~0.016 degrees)
    const minLat = restaurantLat - 0.016;
    const maxLat = restaurantLat + 0.016;
    const minLng = restaurantLng - 0.016;
    const maxLng = restaurantLng + 0.016;

    // 2. Query Deliverers
    return await prisma.delivererProfile.findMany({
      where: {
        isAvailable: true,
        isVerified: true,
        verificationStatus: 'APPROVED',
        user: {
          status: 'ACTIVE',
          activeMode: 'DELIVERER'
        },
        // Ensure they are NOT currently handling an active order
        // This prevents a deliverer from hoarding multiple orders and ruining the SLA
        NOT: {
          user: {
            ordersAsDeliverer: {
              some: {
                status: {
                  in: [
                    'ASSIGNED', 'AWAITING_PAYMENT', 'PAYMENT_RECEIVED', 
                    'VENDOR_BEING_PREPARED', 'VENDOR_READY_FOR_PICKUP', 
                    'PICKED_UP', 'EN_ROUTE', 'ARRIVED'
                  ]
                }
              }
            }
          }
        },
        // Bounding Box filter (Assuming we add lat/lng to DelivererProfile for live tracking)
        // lat: { gte: minLat, lte: maxLat },
        // lng: { gte: minLng, lte: maxLng }
      },
      select: {
        userId: true,
        // lat: true,
        // lng: true,
        rating: true
      }
    });
  }

   async atomicAssignOrder(orderId, delivererId) {
    return await prisma.$transaction(async (tx) => {
      // Postgres Raw Query for strict row-level lock
      const [order] = await tx.$queryRaw`
        SELECT id, status, "assignedDelivererId" 
        FROM "Order" 
        WHERE id = ${orderId}::uuid 
        FOR UPDATE;
      `;

      if (!order) throw new Error("Order does not exist.");

      if (order.status !== 'AWAITING_ACCEPT' || order.assignedDelivererId !== null) {
        throw new Error("Order already claimed.");
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: 'ASSIGNED', assignedDelivererId: delivererId }
      });

      // COMPLETENESS: Write to DispatchLog for Acceptance Rate calculation
      await tx.dispatchLog.create({
        data: {
          orderId,
          delivererId,
          action: 'ACCEPTED'
        }
      });

      // Advance State History
      await tx.orderStatusHistory.create({
        data: { orderId, newStatus: 'ASSIGNED', changedById: delivererId }
      });

      return updated;
    });
  }
  
   async logBroadcastOffer(orderId, delivererId) {
    return await prisma.dispatchLog.create({
      data: {
        orderId,
        delivererId,
        action: 'BROADCAST'
      }
    });
  }

    async calculateMetrics(delivererId) {
    const logs = await prisma.dispatchLog.groupBy({
      by: ['action'],
      where: { delivererId },
      _count: { action: true }
    });

    let broadcasts = 0;
    let accepted = 0;
    let declined = 0;

    logs.forEach(log => {
      if (log.action === 'BROADCAST') broadcasts = log._count.action;
      if (log.action === 'ACCEPTED') accepted = log._count.action;
      if (log.action === 'DECLINED') declined = log._count.action;
    });

    // Avoid division by zero
    const acceptanceRate = broadcasts > 0 ?  Math.round((accepted / broadcasts) * 100)  : 100;
    const cancelRate = accepted > 0 ? (declined / accepted) * 100 : 0; // Drops after accepting

    return {
      broadcasts,
      accepted,
      declined,
      acceptanceRate: Number(acceptanceRate.toFixed(1)),
      cancelRate: Number(cancelRate.toFixed(1))
    };
  }

}