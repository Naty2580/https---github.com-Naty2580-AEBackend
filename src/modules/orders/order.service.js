import prisma from '../../infrastructure/database/prisma.client.js';
import { RestaurantRepository } from '../restaurants/restaurant.repository.js';
import { NotFoundError, BusinessLogicError, ForbiddenError, ConflictError } from '../../core/errors/domain.errors.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { ORDER_ERRORS } from '../../core/errors/error.codes.js';
import { CAMPUS_CONFIG } from '../../config/fee.config.js';
import { isCurrentlyOpen } from '../../core/utils/time.utils.js';
import {
  calculateDistance, calculateDeliveryFee,
  calculateServiceFee, generateShortId, generateOTP
} from '../../core/utils/pricing.utils.js';
import { timeoutService } from './timeout.service.js';
import { DispatchService } from '../dispatch/dispatch.service.js';
import { socketManager } from '../../infrastructure/websockets/socket.manager.js';
import { PayoutService } from '../payouts/payout.service.js';
import { fraudService } from '../fraud/fraud.service.js';
import { notificationService } from '../notifications/notification.service.js';



export class OrderService {
  constructor(orderRepository, restaurantRepository, pricingService) {
    this.orderRepository = orderRepository;
    this.restaurantRepository = new RestaurantRepository;
    this.pricingService = pricingService;
    this.ledgerService = new LedgerService();
    this.dispatchService = new DispatchService();
    this.payoutService = new PayoutService();
  }

  async _getActorProfiles(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        customerProfile: { select: { id: true } },
        delivererProfile: { select: { id: true } }
      }
    });
    return {
      customerId: user?.customerProfile?.id,
      delivererId: user?.delivererProfile?.id
    };
  }

  _aggregateCartItems(items) {
    const aggregated = {};
    for (const item of items) {
      if (aggregated[item.menuId]) {
        if (Number(aggregated[item.menuId].expectedUnitPrice) !== Number(item.expectedUnitPrice)) {
          throw new BusinessLogicError("Inconsistent pricing found in cart items.");
        }
        aggregated[item.menuId].quantity += item.quantity;
      } else {
        aggregated[item.menuId] = { 
          menuId: item.menuId, 
          quantity: item.quantity,
          expectedUnitPrice: Number(item.expectedUnitPrice)
        };
      }
    }
    return Object.values(aggregated);
  }

  async calculateQuote(data) {
    const sanitizedItems = this._aggregateCartItems(data.items);
    const requestedItemIds = sanitizedItems.map(i => i.menuId);

    const restaurant = await this.restaurantRepository.findById(data.restaurantId);
    if (!restaurant || !restaurant.isActive) throw new NotFoundError(ORDER_ERRORS.NOT_FOUND);

    const distanceMeters = calculateDistance(restaurant.lat, restaurant.lng, data.deliveryLat, data.deliveryLng);
    if (distanceMeters > CAMPUS_CONFIG.MAX_RADIUS_METERS) throw new BusinessLogicError(ORDER_ERRORS.OUT_OF_BOUNDS);

    const validItems = await this.orderRepository.fetchActiveMenuItems(data.restaurantId, requestedItemIds);
    if (validItems.length !== requestedItemIds.length) throw new BusinessLogicError(ORDER_ERRORS.INVALID_ITEMS);

    let foodPrice = 0;
    sanitizedItems.forEach(reqItem => {
      const dbItem = validItems.find(vi => vi.id === reqItem.menuId);
      
      // CRITICAL FIX: Ensure both sides of the equation are Numbers before comparing
      const actualDbPrice = Number(dbItem.price);
      
      if (actualDbPrice !== reqItem.expectedUnitPrice) {
        throw new ConflictError(`Price mismatch on item "${dbItem.name}".`);
      }
      foodPrice += actualDbPrice * reqItem.quantity;
    });

    if (foodPrice < Number(restaurant.minOrderValue)) {
      throw new BusinessLogicError(`Minimum order is ${restaurant.minOrderValue} ETB.`);
    }

    const deliveryFee = calculateDeliveryFee(distanceMeters);
    const serviceFee = calculateServiceFee(foodPrice);
    const tip = data.tip || 0;
    
    return {
      distanceMeters, foodPrice, deliveryFee, serviceFee, tip,
      totalAmount: Number((foodPrice + deliveryFee + serviceFee + tip).toFixed(2)),
      payoutAmount: Number((foodPrice + deliveryFee + tip).toFixed(2))
    };
  }

  async checkout(userId, data) {

   const profiles = await this._getActorProfiles(userId);
    if (!profiles.customerId) throw new BusinessLogicError("Customer profile not found.");


    const sanitizedItems = this._aggregateCartItems(data.items);
    const requestedItemIds = sanitizedItems.map(i => i.menuId);

    const restaurant = await this.restaurantRepository.findById(data.restaurantId);
    if (!restaurant || !restaurant.isActive) throw new NotFoundError(ORDER_ERRORS.NOT_FOUND);

    const isOpen = isCurrentlyOpen(restaurant.openingTime, restaurant.closingTime);
    if (!restaurant.isOpen || !isOpen) throw new BusinessLogicError(ORDER_ERRORS.RESTAURANT_CLOSED);

    const distanceMeters = calculateDistance(restaurant.lat, restaurant.lng, data.deliveryLat, data.deliveryLng);
    if (distanceMeters > CAMPUS_CONFIG.MAX_RADIUS_METERS) throw new BusinessLogicError(ORDER_ERRORS.OUT_OF_BOUNDS);

    const validItems = await this.orderRepository.fetchActiveMenuItems(data.restaurantId, requestedItemIds);
    if (validItems.length !== requestedItemIds.length) throw new BusinessLogicError(ORDER_ERRORS.INVALID_ITEMS);

    let foodPrice = 0;
    const validatedItemsData = sanitizedItems.map(reqItem => {
      const dbItem = validItems.find(vi => vi.id === reqItem.menuId);
      
      // CRITICAL FIX: Ensure strict Number casting
      const actualDbPrice = Number(dbItem.price);

      if (actualDbPrice !== reqItem.expectedUnitPrice) {
        throw new ConflictError(`Price mismatch on item "${dbItem.name}".`);
      }

      foodPrice += actualDbPrice * reqItem.quantity;
      return { menuId: reqItem.menuId, quantity: reqItem.quantity, unitPrice: actualDbPrice };
    });

    if (foodPrice < Number(restaurant.minOrderValue)) throw new BusinessLogicError(`Minimum order value is ${restaurant.minOrderValue} ETB.`);

    const deliveryFee = calculateDeliveryFee(distanceMeters);
    const serviceFee = calculateServiceFee(foodPrice);
    const tip = data.tip || 0.00;
    const totalAmount = Number((foodPrice + deliveryFee + serviceFee + tip).toFixed(2));
    const payoutAmount = Number((foodPrice + deliveryFee + tip).toFixed(2));


    const orderPayload = {
      shortId: generateShortId(),
      customerId: profiles.customerId,
      userId: userId,
      restaurantId: data.restaurantId,
      foodPrice, deliveryFee, serviceFee, tip, totalAmount, payoutAmount,
      otpCode: generateOTP()
    };

    const newOrder = await this.orderRepository.createOrderWithItems(orderPayload, validatedItemsData);
    timeoutService.scheduleBroadcastTimeout(newOrder.id, userId);

    return newOrder;
  }

  _sanitizeOrderPayload(order, userRole) {
    // 1. Handshake Security: ONLY the Customer can ever see the OTP code.
    if (userRole !== 'CUSTOMER') {
      order.otpCode = undefined;
    }

    // 2. Deliverer Privacy: Hide Deliverer details from Vendor until they actually arrive.
    if (userRole === 'VENDOR_STAFF' && order.deliverer) {
      if (!['PICKED_UP', 'EN_ROUTE', 'ARRIVED', 'DELIVERED', 'COMPLETED'].includes(order.status)) {
        order.deliverer.user.phoneNumber = undefined;
      }
    }

    // 3. Customer Privacy: Hide Customer details from Deliverer until the food is picked up.
    // This prevents Deliverers from accepting an order just to harvest a student's phone number.
    if (userRole === 'DELIVERER' && order.customer) {
      if (!['PICKED_UP', 'EN_ROUTE', 'ARRIVED', 'DELIVERED', 'COMPLETED'].includes(order.status)) {
        order.customer.user.phoneNumber = undefined;
      }
    }

    // 4. Financial Privacy: Hide internal platform fees from Customers and Deliverers
    if (userRole === 'CUSTOMER' || userRole === 'DELIVERER') {
      order.serviceFee = undefined; // Platform cut is private
      order.transactionFee = undefined; // Gateway cut is private

      // Customers don't need to know exactly how much the deliverer makes 
      // (they just see their subtotal + deliveryFee + tip)
      if (userRole === 'CUSTOMER') {
        order.payoutAmount = undefined;
      }
    }

    return order;
  }

  _emitOrderUpdate(orderId, newStatus, message) {
    socketManager.emitOrderUpdate(orderId, 'ORDER_STATUS_UPDATE', {
      orderId,
      status: newStatus,
      message,
      timestamp: new Date()
    });
  }

  async _verifyTransitionRules(order, targetStatus, allowedRoles, userRole, userId, profiles) {
    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    }

    const restaurant = await this.restaurantRepository.findById(order.restaurantId);

    const validTransitions = {
      'PAYMENT_RECEIVED': ['VENDOR_BEING_PREPARED', 'PICKED_UP'],
      'VENDOR_BEING_PREPARED': ['VENDOR_READY_FOR_PICKUP'],
      'VENDOR_READY_FOR_PICKUP': ['PICKED_UP'],
      'PICKED_UP': ['EN_ROUTE'],
      'EN_ROUTE': ['ARRIVED'],
      'ARRIVED': ['DELIVERED'],
      'DELIVERED': ['COMPLETED']
    };

    const allowedNext = validTransitions[order.status];
    if (!allowedNext || !allowedNext.includes(targetStatus)) {
      throw new BusinessLogicError(`Cannot transition from ${order.status} to ${targetStatus}`);
    }

    if (
      targetStatus === 'PICKED_UP' &&
      order.status === 'PAYMENT_RECEIVED' &&
      restaurant.mode !== 'ADMIN_MANAGED'
    ) {
      throw new BusinessLogicError('Cannot skip vendor preparation states for a Vendor-Managed restaurant.');
    }

    if (userRole === 'VENDOR_STAFF') {
      const access = await this.restaurantRepository.checkVendorAccess(userId, order.restaurantId);
      if (!access) throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    }
     if (userRole === 'DELIVERER' && order.delivererId !== profiles.delivererId) {
      throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    }
  }

  async _enforceTransition(order, targetStatus, allowedRoles, userRole, userId) {
    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    }

    const restaurant = await this.restaurantRepository.findById(order.restaurantId);

    // Define Canonical State Machine Map
    const validTransitions = {
      'PAYMENT_RECEIVED': ['VENDOR_BEING_PREPARED', 'PICKED_UP'],
      'VENDOR_BEING_PREPARED': ['VENDOR_READY_FOR_PICKUP'],
      'VENDOR_READY_FOR_PICKUP': ['PICKED_UP'],
      'PICKED_UP': ['EN_ROUTE'],
      'EN_ROUTE': ['ARRIVED'],
      'ARRIVED': ['DELIVERED'],
      'DELIVERED': ['COMPLETED'] // Note: COMPLETED requires RECEIVED state too
    };

    const allowedNext = validTransitions[order.status];
    if (!allowedNext || !allowedNext.includes(targetStatus)) {
      throw new BusinessLogicError(`Cannot transition from ${order.status} to ${targetStatus}`);
    }

    if (
      targetStatus === 'PICKED_UP' &&
      order.status === 'PAYMENT_RECEIVED' &&
      restaurant.mode !== 'ADMIN_MANAGED'
    ) {
      throw new BusinessLogicError('Cannot skip vendor preparation states for a Vendor-Managed restaurant.');
    }

    // Role-specific IDOR checks
    if (userRole === 'VENDOR_STAFF') {
      const access = await this.restaurantRepository.checkVendorAccess(userId, order.restaurantId);
      if (!access) throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    }
    if (userRole === 'DELIVERER' && order.assignedDelivererId !== userId) {
      throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    }
  }

  async listOrders(userId, userRole, query) {
    // 1. Authorization checks based on requested perspective
    if (query.roleAs === 'VENDOR') {
      if (!query.restaurantId) throw new BusinessLogicError("Restaurant ID required.");
      const access = await this.restaurantRepository.checkVendorAccess(userId, query.restaurantId);
      if (!access && userRole !== 'ADMIN') throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    }

    if (query.roleAs === 'DELIVERER' && userRole !== 'DELIVERER' && userRole !== 'ADMIN') {
      throw new ForbiddenError("You must be a Deliverer to view this feed.");
    }

    const skip = (query.page - 1) * query.limit;
    return await this.orderRepository.findAllOrders({
      skip,
      take: query.limit,
      status: query.status,
      roleAs: query.roleAs,
      userId,
      restaurantId: query.restaurantId
    });
  }

  // async checkout(customerId, data) {

  //   const sanitizedItems = this._aggregateCartItems(data.items);
  //   const requestedItemIds = sanitizedItems.map(i => i.menuId);

  //   // 1. Fetch & Verify Restaurant
  //   const restaurant = await this.restaurantRepository.findById(data.restaurantId);
  //   if (!restaurant || !restaurant.isActive) {
  //     throw new NotFoundError(ORDER_ERRORS.NOT_FOUND);
  //   }

  //   const isOpen = isCurrentlyOpen(restaurant.openingTime, restaurant.closingTime);
  //   if (!restaurant.isOpen || !isOpen) {
  //     throw new BusinessLogicError(ORDER_ERRORS.RESTAURANT_CLOSED);
  //   }

  //   // 2. Geospatial Fencing (1.8km radius)
  //   const distanceMeters = calculateDistance(
  //     restaurant.lat, restaurant.lng,
  //     data.deliveryLat, data.deliveryLng
  //   );
  //   if (distanceMeters > CAMPUS_CONFIG.MAX_RADIUS_METERS) {
  //     throw new BusinessLogicError(ORDER_ERRORS.OUT_OF_BOUNDS);
  //   }

  //   // 3. Fetch & Verify Menu Items

  //   const validItems = await this.orderRepository.fetchActiveMenuItems(data.restaurantId, requestedItemIds);

  //   if (validItems.length !== requestedItemIds.length) {
  //     throw new BusinessLogicError('Some items are no longer available or do not belong to this restaurant.');
  //   }

  //   // 4. Calculate Subtotal (Using Database Prices, ignoring frontend manipulation)
  //   let foodPrice = 0;
  //   const validatedItemsData = sanitizedItems.map(reqItem => {
  //     const dbItem = validItems.find(vi => vi.id === reqItem.menuId);
  //     const actualDbPrice = Number(dbItem.price);

  //     // Prevent Phantom Price Change Attack
  //     if (actualDbPrice !== reqItem.expectedUnitPrice) {
  //       throw new ConflictError(
  //         `Price mismatch on item "${dbItem.name}". The menu price has changed. Please refresh your cart.`
  //       );
  //     }

  //     const itemSubtotal = actualDbPrice * reqItem.quantity;
  //     foodPrice += itemSubtotal;
  //     return {
  //       menuId: reqItem.menuId,
  //       quantity: reqItem.quantity,
  //       unitPrice: actualDbPrice
  //     };
  //   });

  //   if (foodPrice < Number(restaurant.minOrderValue)) {
  //     throw new BusinessLogicError(`Minimum order value is ${restaurant.minOrderValue} ETB.`);
  //   }

  //   // 5. Calculate Financials
  //   const deliveryFee = calculateDeliveryFee(distanceMeters);
  //   const serviceFee = calculateServiceFee(foodPrice);
  //   const tip = data.tip;

  //   const totalAmount = Number((foodPrice + deliveryFee + serviceFee + tip).toFixed(2));
  //   const payoutAmount = Number((foodPrice + deliveryFee + tip).toFixed(2)); // Platform keeps service fee

  //   // 6. Assemble Order Payload
  //   const orderPayload = {
  //     shortId: generateShortId(),
  //     customerId,
  //     restaurantId: data.restaurantId,
  //     foodPrice,
  //     deliveryFee,
  //     serviceFee,
  //     tip,
  //     totalAmount,
  //     payoutAmount,
  //     otpCode: generateOTP() // Handshake code for final delivery verification
  //   };

  //   // 7. Persist Transactionally
  //   const newOrder = await this.orderRepository.createOrderWithItems(orderPayload, validatedItemsData);

  //   timeoutService.scheduleBroadcastTimeout(newOrder.id, customerId);
  //   this.dispatchService.broadcastNewOrder(newOrder).catch(console.error);

  //   return newOrder;


  // }

  async getOrderDetails(userId, userRole, orderId) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundError(ORDER_ERRORS.NOT_FOUND);

    // Strict IDOR Protection: You can only view an order if you are involved in it
     const profiles = await this._getActorProfiles(userId);

    if (userRole === 'CUSTOMER' && order.customerId !== profiles.customerId) {
      throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    }
    // CRITICAL FIX: Compare against delivererProfile.id
    if (userRole === 'DELIVERER' && order.delivererId !== profiles.delivererId) {
      throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    }
    if (userRole === 'VENDOR_STAFF') {
      const access = await this.restaurantRepository.checkVendorAccess(userId, order.restaurantId);
      if (!access) throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    }


    return this._sanitizeOrderPayload(order, userRole);

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

  async cancelOrder(actorId, userRole, orderId, reason) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundError(ORDER_ERRORS.NOT_FOUND);

    const profiles = await this._getActorProfiles(actorId);

    // FIX: Use profile check
    if (userRole === 'CUSTOMER' && order.customerId !== profiles.customerId) {
      throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    }
    if (userRole === 'VENDOR_STAFF') {
      const access = await this.restaurantRepository.checkVendorAccess(actorId, order.restaurantId);
      if (!access) throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    }
    // Note: Deliverers should NOT cancel an order, they should DROP it (which we built previously).
    // If a Deliverer cancels, the customer loses their food. If they drop, another deliverer can take it.
    if (userRole === 'DELIVERER') {
      throw new ForbiddenError("Deliverers cannot cancel an order. Use the drop feature instead to requeue it.");
    }

    const cancellableStates = ['CREATED', 'AWAITING_ACCEPT', 'ASSIGNED', 'AWAITING_PAYMENT', 'PAYMENT_RECEIVED', 'VENDOR_BEING_PREPARED', 'VENDOR_READY_FOR_PICKUP'];

    if (!cancellableStates.includes(order.status)) {
      throw new BusinessLogicError("Cannot cancel an order that has already been picked up.");
    }

    try {
      // 1. OCC State Transition
      await this.orderRepository.cancelOrderOCC(orderId, order.status, actorId, reason);

      // 2. Immediate Escrow Reversal
      if (order.paymentStatus === 'CAPTURED') {

        fraudService.checkRefundAbuse(order.customerId).catch(console.error);

        // Mark payment as refunded in the DB
        await prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'REFUNDED' }
        });

        // Trigger Ledger
        await this.ledgerService.processFinancialEvent(
          order, 'REFUND', order.totalAmount, order.customerId
        );

        import('../../infrastructure/payment/chapa.adapter.js').then(({ ChapaAdapter }) => {
          ChapaAdapter.issueRefund(order.chapaRef, order.totalAmount).catch(console.error);
        });
      }

      // REAL-TIME PUSH: Alert anyone watching this order
      this._emitOrderUpdate(orderId, 'CANCELLED', `Order was cancelled. Reason: ${reason || 'Not provided'}`);

    } catch (error) {
      if (error.message === 'STATE_CONFLICT') {
        throw new ConflictError("Order state changed during cancellation. Please refresh.");
      }
      throw error;
    }
  }

  async delivererDropOrder(delivererId, orderId, reason) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundError(ORDER_ERRORS.NOT_FOUND);

     const profiles = await this._getActorProfiles(delivererId);

    // FIX: Compare against DelivererProfile.id
    if (order.delivererId !== profiles.delivererId) {
      throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    }

    fraudService.checkDelivererCancelRate(delivererId).catch(console.error);

    const droppableStates = ['ASSIGNED', 'AWAITING_PAYMENT', 'PAYMENT_RECEIVED'];
    if (!droppableStates.includes(order.status)) {
      throw new BusinessLogicError("Cannot drop an order after food pickup has been confirmed.");
    }

    try {
      // 1. Requeue the order
      await this.orderRepository.dropDelivererAssignment(orderId, order.status, delivererId, reason);

      // 2. CRITICAL FIX: Restart the Broadcast Timeout clock
      // This gives the newly requeued order a fresh 15-minute window to find a new deliverer
      timeoutService.scheduleBroadcastTimeout(orderId, order.customerId);

      // REAL-TIME PUSH: Alert the customer that the deliverer dropped
      this._emitOrderUpdate(orderId, 'AWAITING_ACCEPT', `Deliverer dropped the order. Re-broadcasting...`);

    } catch (error) {
      if (error.message === 'STATE_CONFLICT') {
        throw new ConflictError("Order state changed. Please refresh.");
      }
      throw error;
    }
  }

  async updateVendorState(userId, userRole, orderId, status, estimatedPrepTimeMins) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundError(ORDER_ERRORS.NOT_FOUND);

    await this._verifyTransitionRules(order, status, ['VENDOR_STAFF', 'ADMIN'], userRole, userId);

    try {
       if (status === 'VENDOR_BEING_PREPARED' && estimatedPrepTimeMins) {
        await this.orderRepository.transitionOrderStatusWithETA(
          orderId, order.status, status, userId, estimatedPrepTimeMins
        );
      } else {
      // Execute OCC Transition
      await this.orderRepository.transitionOrderStatus(orderId, order.status, status, userId);

      // REAL-TIME PUSH: Notify Customer and Deliverer
      this._emitOrderUpdate(orderId, status, `Vendor has updated the order status to: ${status}`);
      }
    } catch (error) {
      if (error.message === 'STATE_CONFLICT') {
        throw new ConflictError("Order state was modified by another request. Please refresh.");
      }
      throw error;
    }
  }

  async updateDelivererState(userId, userRole, orderId, status, currentLat, currentLng) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundError(ORDER_ERRORS.NOT_FOUND);

    const profiles = await this._getActorProfiles(userId);
       
    await this._verifyTransitionRules(order, status, ['DELIVERER', 'ADMIN'], userRole, userId, profiles);

    try {
      // If Deliverer marks DELIVERED, and Customer already marked RECEIVED, finalize immediately.
      if (status === 'DELIVERED' && order.status === 'RECEIVED') {
         await this.orderRepository.finalizeOrderAndTriggerPayout(
          orderId, 'RECEIVED', userId, this.payoutService
        );

      if (status === 'PICKED_UP') {
      fraudService.checkGPSMismatch(orderId, currentLat, currentLng).catch(console.error);
    }

        this._emitOrderUpdate(orderId, 'COMPLETED', `Order fully complete. Escrow released.`);

        return;
      }

      // Otherwise, just do a normal state transition
      await this.orderRepository.transitionOrderStatus(orderId, order.status, status, userId);
      this._emitOrderUpdate(orderId, status, `Deliverer updated status to: ${status}`);

    } catch (error) {
      if (error.message === 'STATE_CONFLICT') {
        throw new ConflictError("Order state was modified by another request. Please refresh.");
      }
      throw error;
    }
  }

  async completeOrderWithOTP(userId, orderId, otpCode) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundError(ORDER_ERRORS.NOT_FOUND);

    //fetch delivererId from userId
    const delivererId = await this._getActorProfiles(userId).then((profiles) => profiles.delivererId);
    // IDOR Check: Only the assigned deliverer can submit the OTP
    if (order.delivererId !== delivererId) {
      throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    }

    if (order.status !== 'ARRIVED' && order.status !== 'EN_ROUTE') {
      throw new BusinessLogicError("Order must be in transit or arrived to complete handover.");
    }

    if (order.otpCode !== otpCode) {
      throw new BusinessLogicError("Invalid PIN code. Please check the customer's screen.");
    }

    try {
      await this.orderRepository.executeCryptographicHandshake(
        orderId, order.status, userId,delivererId, this.payoutService
      );

      this._emitOrderUpdate(orderId, 'COMPLETED', `Delivery confirmed. Escrow released.`);
    } catch (error) {
      if (error.message === 'STATE_CONFLICT') {
        throw new ConflictError("Order state changed concurrently. Please check order status.");
      }
      throw error;
    }
  }

  async delivererDropOrder(delivererId, orderId, reason) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundError(ORDER_ERRORS.NOT_FOUND);

    if (order.assignedDelivererId !== delivererId) {
      throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    }

    const droppableStates = ['ASSIGNED', 'AWAITING_PAYMENT', 'PAYMENT_RECEIVED'];

    if (!droppableStates.includes(order.status)) {
      throw new BusinessLogicError("Cannot drop an order after food pickup has been confirmed. You must raise a dispute instead.");
    }

    try {
      // Safely requeue the order using OCC
      await this.orderRepository.dropDelivererAssignment(orderId, order.status, delivererId, reason);

      // Note: The 15-minute broadcast timeout scheduler (started at creation) is still running.
      // If no new deliverer picks it up before the original 15m expires, it will auto-cancel and refund.
    } catch (error) {
      if (error.message === 'STATE_CONFLICT') {
        throw new ConflictError("Order state changed. Please refresh.");
      }
      throw error;
    }
  }

   async reportUnfulfillable(delivererId, orderId, reasonEnum, details) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundError(ORDER_ERRORS.NOT_FOUND);

    const profiles = await this._getActorProfiles(delivererId);

    // FIX: Profile check
    if (order.delivererId !== profiles.delivererId) {
      throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    }

    // A deliverer can only claim it's unfulfillable BEFORE they pick it up.
    // If they already picked it up, they possess the food, so they must use the Dispute system instead.
    const prePickupStates = ['ASSIGNED', 'AWAITING_PAYMENT', 'PAYMENT_RECEIVED', 'VENDOR_BEING_PREPARED', 'VENDOR_READY_FOR_PICKUP'];
    
    if (!prePickupStates.includes(order.status)) {
      throw new BusinessLogicError("Cannot report order as unfulfillable after food has been picked up. Please raise a dispute.");
    }

    try {
      await this.orderRepository.markUnfulfillable(orderId, delivererId, reasonEnum, details);

      // Refund the Escrow if the customer had already paid
      if (order.paymentStatus === 'CAPTURED') {
        await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: 'REFUNDED' } });
        await this.ledgerService.processFinancialEvent(
          order, 'REFUND', order.totalAmount, order.customerId
        );
      }

      this._emitOrderUpdate(orderId, 'CANCELLED', `Order cancelled by deliverer. Reason: ${reasonEnum}`);

    } catch (error) {
      throw new ConflictError("Failed to report issue. Please refresh the order state.");
    }
  }

  /**
   * NEW: Allows Customer or Deliverer to freeze an order that has gone wrong.
   */
  async raiseDispute(userId, userRole, orderId, reason) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundError(ORDER_ERRORS.NOT_FOUND);

    // IDOR Check
    if (userRole === 'CUSTOMER' && order.customerId !== userId) throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    if (userRole === 'DELIVERER' && order.assignedDelivererId !== userId) throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);

    const nonDisputableStates = ['CREATED', 'AWAITING_ACCEPT', 'COMPLETED', 'CANCELLED', 'DISPUTED'];
    if (nonDisputableStates.includes(order.status)) {
      throw new BusinessLogicError(`Cannot raise a dispute for an order in ${order.status} state.`);
    }

    try {
      // Freeze the order and generate the Dispute ticket
      await this.orderRepository.markDisputed(orderId, order.status, userId, reason);

      // REAL-TIME PUSH: Freeze everyone's screen
      this._emitOrderUpdate(orderId, 'DISPUTED', `Order frozen. A dispute was raised: ${reason}`);

    } catch (error) {
      if (error.message === 'STATE_CONFLICT') throw new ConflictError("Order state changed. Please refresh.");
      throw error;
    }
  }

   /**
   * NEW: Fetch Active Delivery (Deliverer View)
   */
  async getActiveDelivery(userId, userRole) {
    if (userRole !== 'DELIVERER' && userRole !== 'ADMIN') {
      throw new ForbiddenError("Only deliverers have active deliveries.");
    }

    const activeOrder = await this.orderRepository.findActiveDelivery(userId);
    
    if (!activeOrder) return null; // No active delivery is a valid state (200 OK, null data)

    // Data Masking: Hide customer phone until food is picked up
    if (!['PICKED_UP', 'EN_ROUTE', 'ARRIVED', 'DELIVERED', 'COMPLETED'].includes(activeOrder.status)) {
      if (activeOrder.customer?.user) {
        activeOrder.customer.user.phoneNumber = undefined;
      }
    }

    return activeOrder;
  }

  /**
   * NEW: Fetch Kitchen Queue (Vendor View)
   */
  async getKitchenQueue(userId, userRole, restaurantId) {
    if (userRole !== 'VENDOR_STAFF' && userRole !== 'ADMIN') {
      throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    }

    if (userRole === 'VENDOR_STAFF') {
      const access = await this.restaurantRepository.checkVendorAccess(userId, restaurantId);
      if (!access) throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
    }

    return await this.orderRepository.getKitchenQueue(restaurantId);
  }

   async resolveDispute(adminId, disputeId, resolution, notes) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { order: true }
    });

    if (!dispute || dispute.status === 'RESOLVED') {
      throw new BusinessLogicError("Dispute not found or already resolved.");
    }

    const order = dispute.order;

    await prisma.$transaction(async (tx) => {
      // 1. Mark dispute resolved
      await tx.dispute.update({
        where: { id: disputeId },
        data: { status: 'RESOLVED', resolution: notes, assignedAdminId: adminId }
      });

      // 2. Free the trapped order
      const newOrderStatus = resolution === 'REFUND_CUSTOMER' ? 'CANCELLED' : 'COMPLETED';
      await tx.order.update({
        where: { id: order.id },
        data: { status: newOrderStatus, paymentStatus: resolution === 'REFUND_CUSTOMER' ? 'REFUNDED' : 'CAPTURED' }
      });

      await tx.orderStatusHistory.create({
        data: { orderId: order.id, newStatus: newOrderStatus, changedById: adminId }
      });

      // 3. Resolve the Ledger
      if (resolution === 'REFUND_CUSTOMER') {
        await this.ledgerService.processFinancialEvent(
          order, 'REFUND', order.totalAmount, order.customerId, tx
        );
      } else {
        await this.payoutService.executeDelivererPayout(order, tx);
        const maliciousReview = await tx.review.findUnique({ where: { orderId: order.id } });
        if (maliciousReview && maliciousReview.delivererRating < 3) {
           await tx.review.update({
             where: { id: maliciousReview.id },
             data: { delivererRating: null, comment: "[Redacted by Admin Dispute]" }
           });
          }
      }
     const resolutionMessage = resolution === 'REFUND_CUSTOMER' 
        ? 'The dispute was resolved in your favor. A refund has been issued.' 
        : 'The dispute was resolved in the Deliverer\'s favor. No refund will be issued.';
        
      await notificationService.sendNotification(
        order.customer.userId, 'Dispute Resolved', resolutionMessage, 'DISPUTE_UPDATE'
      );
      
      if (order.assignedDelivererId) {
        const delivMessage = resolution === 'PAY_DELIVERER' 
          ? 'The dispute was resolved in your favor. Your payout is processing.' 
          : 'The dispute was resolved in the Customer\'s favor. You will not receive a payout for this order.';
        await notificationService.sendNotification(
          order.assignedDelivererId, 'Dispute Resolved', delivMessage, 'DISPUTE_UPDATE'
        );
      }
    });
  }

   async submitReview(userId, userRole, orderId, data) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundError(ORDER_ERRORS.NOT_FOUND);
    if (order.status !== 'COMPLETED') throw new BusinessLogicError("Can only review completed orders.");

    if (userRole === 'CUSTOMER') {
      if (order.customer.userId !== userId) throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
      return await this.orderRepository.upsertCustomerReview(
        orderId, userId, order.restaurantId, order.assignedDelivererId, data
      );
    } 
    
    if (userRole === 'DELIVERER') {
      if (order.assignedDelivererId !== userId) throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
      // Pass order.customer.userId to ensure the rating applies to the root user profile
      return await this.orderRepository.upsertDelivererReview(
        orderId, order.customer.userId, data
      );
    }

    throw new ForbiddenError("Role not authorized to submit reviews.");
  }

  /**
   * NEW: Manual Payout Retry (For Admins)
   */
  async retryFailedPayout(adminId, orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError('Order not found');
    
    if (order.status !== 'COMPLETED') {
      throw new BusinessLogicError('Can only retry payouts for COMPLETED orders.');
    }

    // Attempt payout outside of a strict transaction to prevent locking the whole DB
    // The PayoutService handles its own internal idempotency check.
    await this.payoutService.executeDelivererPayout(order);
  }

  //  async calculateQuote(data) {
  //   const sanitizedItems = this._aggregateCartItems(data.items);
  //   const requestedItemIds = sanitizedItems.map(i => i.menuId);

  //   const restaurant = await this.restaurantRepository.findById(data.restaurantId);
  //   if (!restaurant || !restaurant.isActive) throw new NotFoundError(ORDER_ERRORS.NOT_FOUND);

  //   const distanceMeters = calculateDistance(restaurant.lat, restaurant.lng, data.deliveryLat, data.deliveryLng);
  //   if (distanceMeters > CAMPUS_CONFIG.MAX_RADIUS_METERS) throw new BusinessLogicError(ORDER_ERRORS.OUT_OF_BOUNDS);

  //   const validItems = await this.orderRepository.fetchActiveMenuItems(data.restaurantId, requestedItemIds);
  //   if (validItems.length !== requestedItemIds.length) throw new BusinessLogicError(ORDER_ERRORS.INVALID_ITEMS);

  //   let foodPrice = 0;
  //   sanitizedItems.forEach(reqItem => {
  //     const dbItem = validItems.find(vi => vi.id === reqItem.menuId);
  //     if (Number(dbItem.price) !== reqItem.expectedUnitPrice) {
  //       throw new ConflictError(`Price mismatch on item "${dbItem.name}".`);
  //     }
  //     foodPrice += Number(dbItem.price) * reqItem.quantity;
  //   });

  //   if (foodPrice < Number(restaurant.minOrderValue)) {
  //     throw new BusinessLogicError(`Minimum order is ${restaurant.minOrderValue} ETB.`);
  //   }

  //   const deliveryFee = calculateDeliveryFee(distanceMeters);
  //   const serviceFee = calculateServiceFee(foodPrice);
  //   const tip = data.tip || 0;
    
  //   return {
  //     distanceMeters,
  //     foodPrice,
  //     deliveryFee,
  //     serviceFee,
  //     tip,
  //     totalAmount: Number((foodPrice + deliveryFee + serviceFee + tip).toFixed(2)),
  //     payoutAmount: Number((foodPrice + deliveryFee + tip).toFixed(2))
  //   };
  // }

  /**
   * NEW: Review Submission
   */
  // async submitReview(customerId, orderId, data) {
  //   const order = await this.orderRepository.findById(orderId);
  //   if (!order) throw new NotFoundError(ORDER_ERRORS.NOT_FOUND);

  //   if (order.customerId !== customerId) throw new ForbiddenError(ORDER_ERRORS.UNAUTHORIZED_ACCESS);
  //   if (order.status !== 'COMPLETED') throw new BusinessLogicError("Can only review completed orders.");

  //   // Ensure they haven't already reviewed it
  //   const existingReview = await prisma.review.findUnique({ where: { orderId } });
  //   if (existingReview) throw new ConflictError("Order has already been reviewed.");

  //   return await this.orderRepository.createReviewAndUpdateRatings(
  //     orderId, customerId, order.restaurantId, order.assignedDelivererId, data
  //   );
  // }

}