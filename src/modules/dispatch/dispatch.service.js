import { DispatchRepository } from './dispatch.repository.js';
import { calculateDistance } from '../../core/utils/pricing.utils.js';
import { timeoutService } from '../orders/timeout.service.js';
import { CAMPUS_CONFIG } from '../../config/fee.config.js';
import { socketManager } from '../../infrastructure/websockets/socket.manager.js';


export class DispatchService {
  constructor() {
    this.repository = new DispatchRepository();
  }

  async acceptOrder(orderId, delivererId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { delivererProfile: { select: { id: true } } }
    });

    if (!user || !user.delivererProfile) {
      throw new ForbiddenError("Deliverer profile not found.");
    }

    // 1. Atomic DB assignment
    const order = await this.repository.atomicAssignOrder(orderId, userId, user.delivererProfile.id);
    
    // 2. Start the 5-minute payment countdown
    timeoutService.schedulePaymentTimeout(orderId,userId); // Pass customerId for tracking
    
    // 3. REAL-TIME PUSH: Tell the customer a deliverer was found!
    socketManager.emitOrderUpdate(orderId, 'ORDER_STATUS_UPDATE', {
      orderId,
      status: 'ASSIGNED',
      message: 'A deliverer has accepted your order. Please complete your payment.',
      timestamp: new Date()
    });

    return order;
  }

  async getEligibleDeliverers(restaurantLat, restaurantLng) {
    const deliverers = await this.repository.findNearbyDeliverers(restaurantLat, restaurantLng);
    
    // Precise radius filter (1.8km = 1800m)
    return deliverers.filter(d => {
      // Logic to get deliverer location from their last tracked position
      // For this implementation, we assume deliverer location is stored on the profile
      const distance = calculateDistance(
        restaurantLat, restaurantLng, 
        d.lat || 0, d.lng || 0
      );
      return distance <= 1800;
    });
  }

  async broadcastNewOrder(order) {
    try {
      const restaurant = order.restaurant;
      const potentialDeliverers = await this.repository.findNearbyDeliverers(restaurant.lat, restaurant.lng);

      // 1. Distance Filter (<= 1.8km)
      let eligibleDeliverers = potentialDeliverers.filter(d => {
        if (!d.lat || !d.lng) return false;
        const distance = calculateDistance(restaurant.lat, restaurant.lng, d.lat, d.lng);
        return distance <= CAMPUS_CONFIG.MAX_RADIUS_METERS;
      });

      if (eligibleDeliverers.length === 0) return;

      // 2. CRITICAL FIX: Prioritize by Rating (Descending)
      // High-rated deliverers get the socket ping slightly faster, giving them first pick.
      eligibleDeliverers.sort((a, b) => Number(b.rating) - Number(a.rating));

      const broadcastPayload = { /* ... existing payload generation ... */ };

      // 3. Staggered Broadcast (Priority Matching)
      let delay = 0;
      eligibleDeliverers.forEach((deliverer, index) => {
        if (socketManager.connectedDeliverers.has(deliverer.userId)) {
          // Top 3 deliverers get it instantly. Others get it delayed by 2 seconds each.
          const currentDelay = index < 3 ? 0 : delay += 2000;

          setTimeout(() => {
            socketManager.emitToDeliverer(deliverer.userId, 'ORDER_BROADCAST', broadcastPayload);
            this.repository.logBroadcastOffer(order.id, deliverer.userId).catch(console.error);
          }, currentDelay);
        }
      });

    } catch (error) {
      console.error(`🔥 [DISPATCH ERROR]:`, error);
    }
  }

   async getDelivererMetrics(userId, targetDelivererId, userRole) {
    if (userRole === 'DELIVERER' && userId !== targetDelivererId) {
      throw new ForbiddenError("You can only view your own metrics.");
    }
    
    // Calculate live stats
    const metrics = await this.repository.calculateMetrics(targetDelivererId);

    // Update the DelivererProfile with the live rating (Optional: caching for faster queries)
    // await prisma.delivererProfile.update({ where: { userId: targetDelivererId }, data: { rating: newRating }});

    return metrics;
  }

    async updateLiveLocation(delivererId, lat, lng, activeOrderId) {
    // 1. Update Database
    await this.repository.updateLiveLocation(delivererId, lat, lng);

    // 2. If the deliverer is currently holding an order, push coordinates to the Customer
    if (activeOrderId) {
      socketManager.emitOrderUpdate(activeOrderId, 'DELIVERER_LOCATION_UPDATE', {
        lat,
        lng,
        timestamp: new Date()
      });
    }
  }
  
}