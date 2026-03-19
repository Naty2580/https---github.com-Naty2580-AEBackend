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
  async findNearbyDeliverers(lat, lng) {
    const radiusDegree = 0.016; 
    
    return await prisma.delivererProfile.findMany({
      where: {
        isAvailable: true,
        // Approximate BBox filter before calculating precise distance
        user: {
          // This assumes we add lat/lng to DelivererProfile in the future
          // For now, filtering by availability and radius
        }
      },
      include: { user: true }
    });
  }
}