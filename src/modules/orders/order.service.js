import prisma from '../../infrastructure/database/prisma.client.js';
import { BusinessLogicError } from '../../core/errors/domain.errors.js';

export class OrderService {
    constructor(orderRepository, restaurantRepository, pricingService) {
    this.orderRepository = orderRepository;
    this.restaurantRepository = restaurantRepository;
    this.pricingService = pricingService;
  }




  async createOrder(customerId, data) {
    // 1. Fetch dependencies and validate restaurant status
    const restaurant = await this.restaurantRepository.findById(data.restaurantId);
    if (!restaurant?.isOpen) throw new BusinessLogicError("Restaurant is currently closed.");

    // 2. Validate items and calculate subtotals (fetch actual prices from DB)
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: data.items.map(i => i.menuId) }, restaurantId: data.restaurantId }
    });

    if (menuItems.length !== data.items.length) throw new BusinessLogicError("Some items are invalid.");

    const subtotal = data.items.reduce((acc, item) => {
      const price = menuItems.find(m => m.id === item.menuId).price;
      return acc + (Number(price) * item.quantity);
    }, 0);

    // 3. Calculate Fees
    const financials = this.pricingService.calculateTotals(subtotal, 500, data.tip); // 500m as default distance

    // 4. Atomic Transaction
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          shortId: `AE-${Math.floor(1000 + Math.random() * 9000)}`,
          customerId,
          restaurantId: data.restaurantId,
          ...financials,
          items: {
            create: data.items.map(item => ({
              menuId: item.menuId,
              quantity: item.quantity,
              unitPrice: menuItems.find(m => m.id === item.menuId).price
            }))
          }
        }
      });

      // Initial state history log
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, newStatus: 'CREATED', changedById: customerId }
      });

      return order;
    });
  }


  // async create(customerId, data) {
  //   const restaurant = await this.restaurantRepository.findById(data.restaurantId);
  //   if (!restaurant?.isOpen) throw new BusinessLogicError("Restaurant is currently closed.");

  //   // 1. Calculate totals (Server-side price verification)
  //   // 2. Logic to generate shortId (e.g., AE-1024)
  //   // 3. Persist
  //   return await this.orderRepository.createFullOrder({ ...data, customerId, shortId: "AE-" + Date.now().toString().slice(-4) }, data.items);
  // }

  async cancel(orderId, userId) {
    const order = await this.orderRepository.findById(orderId);
    if (['PICKED_UP', 'DELIVERED', 'COMPLETED'].includes(order.status)) {
      throw new BusinessLogicError("Cannot cancel order at this stage.");
    }
    // Perform update...
  }
  

  /**
   * Enforces State Machine rules
   */
  async transitionStatus(orderId, nextStatus, userId) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      
      if (!this.isValidTransition(order.status, nextStatus)) {
        throw new BusinessLogicError(`Cannot transition from ${order.status} to ${nextStatus}`);
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: nextStatus }
      });

      // Log the history for audit trail
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          newStatus,
          oldStatus: order.status,
          changedById: userId
        }
      });

      return updatedOrder;
    });
  }

  isValidTransition(current, next) {
    const transitions = {
      CREATED: ['AWAITING_ACCEPT'],
      AWAITING_ACCEPT: ['ASSIGNED', 'CANCELLED'],
      ASSIGNED: ['AWAITING_PAYMENT'],
      // ... etc
    };
    return transitions[current]?.includes(next);
  }




 
}