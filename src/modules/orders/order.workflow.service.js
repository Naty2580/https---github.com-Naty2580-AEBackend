import prisma from '../../infrastructure/database/prisma.client.js';
import { BusinessLogicError } from '../../core/errors/domain.errors.js';

export class OrderWorkflowService {
  /**
   * Deliverer accepts the order.
   * Logic: Sets status to ASSIGNED, locks deliverer.
   */
  async acceptOrder(orderId, userId) {

    const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { delivererProfile: true }
        });
    
         if (!user || !user.delivererProfile) {
          throw new BusinessLogicError("Deliverer profile not found. Cannot accept order.");
        }
        const delivererId = user.delivererProfile.id;

    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      
      if (order.status !== 'AWAITING_ACCEPT') throw new BusinessLogicError("Order not available.");

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { 
          status: 'ASSIGNED', 
          delivererId: delivererId 
        }
      });

      // Emit event: 'ORDER_ASSIGNED' -> triggers 5-min timer in BullMQ
      return updated;
    });
  }

  /**
   * Vendor/Deliverer updates status.
   * Logic: Strictly enforce role-based access to state transitions.
   */
  async updateStatus(orderId, nextStatus, actorId, actorRole) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    // 1. Authorization Gate
    this.authorizeTransition(order, nextStatus, actorRole, actorId);

    // 2. Perform Update
    return await prisma.order.update({
      where: { id: orderId },
      data: { status: nextStatus }
    });
  }

  authorizeTransition(order, nextStatus, role, actorId) {
    if (nextStatus === 'PICKED_UP' && order.assignedDelivererId !== actorId) {
      throw new BusinessLogicError("Only the assigned deliverer can mark this.");
    }
    if (nextStatus === 'VENDOR_READY_FOR_PICKUP' && role !== 'VENDOR_STAFF') {
      throw new BusinessLogicError("Only the vendor can mark this status.");
    }
  }
}
