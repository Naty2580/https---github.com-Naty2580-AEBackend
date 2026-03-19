import prisma from '../../infrastructure/database/prisma.client.js';

export class OrderRepository {
  async createFullOrder(orderData, items) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: { ...orderData, items: { create: items } }
      });
      return order;
    });
  }

  async findById(id) {
    return await prisma.order.findUnique({
      where: { id },
      include: { items: true, statusHistory: true }
    });
  }



  async atomicAssignOrder(orderId, delivererId) {
    return await prisma.$transaction(async (tx) => {
      // 1. SELECT ... FOR UPDATE (This blocks other concurrent transactions for this row)
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, assignedDelivererId: true },
        // The magic: FOR UPDATE
        _lock: 'update' 
      });

      // 2. Strict Business Logic Verification
      if (!order) {
        throw new Error("Order does not exist.");
      }

      if (order.status !== 'AWAITING_ACCEPT' || order.assignedDelivererId !== null) {
        throw new Error("This order has already been claimed by another deliverer.");
      }

      // 3. Perform the update while holding the lock
      return await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'ASSIGNED',
          assignedDelivererId: delivererId
        }
      });
    });
  }
}