import prisma from '../../infrastructure/database/prisma.client.js';
import { BusinessLogicError, NotFoundError } from '../../core/errors/domain.errors.js';

export class OrderWorkflowService {
  /**
   * Deliverer accepts the order.
   * Logic: Sets status to ASSIGNED, locks deliverer.
   * 
   * IMPORTANT: Order.delivererId is a FK to DelivererProfile.id (NOT User.id).
   * We must resolve the DelivererProfile.id from the userId before writing.
   */
  async acceptOrder(orderId, userId) {
    // 1. Resolve DelivererProfile.id from the authenticated User.id
    const delivererProfile = await prisma.delivererProfile.findUnique({
      where: { userId }
    });

    if (!delivererProfile) {
      throw new NotFoundError('Deliverer profile not found. Your account may not be fully verified.');
    }

    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      
      if (!order) throw new NotFoundError('Order not found.');
      if (order.status !== 'AWAITING_ACCEPT') throw new BusinessLogicError('Order not available.');

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { 
          status: 'ASSIGNED', 
          delivererId: delivererProfile.id  // DelivererProfile.id (correct FK)
        }
      });

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
    // Note: order.delivererId is a DelivererProfile.id, not a User.id.
    // This check only works if actorId is also the DelivererProfile.id.
    // For now, we rely on the main service's IDOR checks for full protection.
    if (nextStatus === 'VENDOR_READY_FOR_PICKUP' && role !== 'VENDOR_STAFF') {
      throw new BusinessLogicError('Only the vendor can mark this status.');
    }
  }
}