import { DispatchRepository } from './dispatch.repository.js';
import { calculateDistance } from '../../core/utils/pricing.utils.js';
import { timeoutService } from '../orders/timeout.service.js';
import { CAMPUS_CONFIG } from '../../config/fee.config.js';
import { socketManager } from '../../infrastructure/websockets/socket.manager.js';
import prisma from '../../infrastructure/database/prisma.client.js';



export class DispatchService {
  constructor() {
    this.repository = new DispatchRepository();
  }

  async acceptOrder(orderId, UserId) {
    const user = await prisma.user.findUnique({
      where: { id: UserId },
      select: { delivererProfile: { select: { id: true } } }
    });

    if (!user || !user.delivererProfile) {
      throw new ForbiddenError("Deliverer profile not found.");
    }

    // 1. Atomic DB assignment
    const order = await this.repository.atomicAssignOrder(orderId, UserId, user.delivererProfile.id);
    
    // 2. Start the 5-minute payment countdown
    timeoutService.schedulePaymentTimeout(orderId,UserId); // Pass customerId for tracking
    
    // 3. REAL-TIME PUSH: Tell the customer a deliverer was found!
    socketManager.emitOrderUpdate(orderId, 'ORDER_STATUS_UPDATE', {
      orderId,
      status: 'ASSIGNED',
      message: 'A deliverer has accepted your order. Please complete your payment.',
      timestamp: new Date()
    });

     if (socketManager.io) {
      socketManager.io.to('active_deliverers').emit('ORDER_STATUS_UPDATE', {
        orderId,
        status: 'ASSIGNED', // The frontend socket listener will see this isn't AWAITING_ACCEPT and remove it
      });
    }

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

      // // 1. Distance Filter (<= 1.8km)
      // let eligibleDeliverers = potentialDeliverers.filter(d => {
      //   if (!d.lat || !d.lng) return false;
      //   const distance = calculateDistance(restaurant.lat, restaurant.lng, d.lat, d.lng);
      //   return distance <= CAMPUS_CONFIG.MAX_RADIUS_METERS;
      // });
      
      //for testing version, we will skip the distance filter and broadcast to all deliverers
      let eligibleDeliverers = potentialDeliverers;

      if (eligibleDeliverers.length === 0) return;

     // NEW: Fetch all deliverers who have BOOKMARKED this restaurant
      const bookmarkedUserIds = await prisma.bookmark.findMany({
        where: { type: 'RESTAURANT', targetId: order.restaurantId },
        select: { userId: true }
      }).then(res => res.map(b => b.userId));

      // CRITICAL FIX: The Dispatch Prioritization Algorithm
      // 1st Priority: Have they bookmarked the restaurant? (Camping behavior)
      // 2nd Priority: What is their rating?
      eligibleDeliverers.sort((a, b) => {
        const aBookmarks = bookmarkedUserIds.includes(a.userId) ? 1 : 0;
        const bBookmarks = bookmarkedUserIds.includes(b.userId) ? 1 : 0;
        
        if (aBookmarks !== bBookmarks) {
          return bBookmarks - aBookmarks; // Priority to bookmarked
        }
        
        return Number(b.rating) - Number(a.rating); // Fallback to rating
      });

       const broadcastPayload = {
        orderId: order.id,
        shortId: order.shortId,
        
        // Pickup Details
        restaurant: {
          name: restaurant.name,
          location: restaurant.location,
          lat: restaurant.lat,
          lng: restaurant.lng
        },

        // Dropoff Details (Dorm block only, no exact room or name)
        dropoffLocation: order.customer?.defaultDormBlock || "ASTU Campus",
        
        // Financial Incentive (What the deliverer earns)
        earnings: {
          deliveryFee: Number(order.deliveryFee),
          tip: Number(order.tip),
          totalPayout: Number(order.deliveryFee) + Number(order.tip)
        },

        // Summary of items so they know if they need a big bag
        itemCount: order.items ? order.items.reduce((acc, item) => acc + item.quantity, 0) : 1,

        createdAt: order.createdAt
      };

      // 3. Staggered Broadcast (Priority Matching)
      let delay = 0;
      eligibleDeliverers.forEach((deliverer, index) => {
        if (socketManager.connectedDeliverers.has(deliverer.userId)) {
          const distanceToRestaurant = Math.round(
            calculateDistance(restaurant.lat, restaurant.lng, deliverer.lat || 0, deliverer.lng || 0)
          );

          const personalizedPayload = {
            ...broadcastPayload,
            distanceToRestaurantMeters: distanceToRestaurant
          };
          // Top 3 deliverers get it instantly. Others get it delayed by 2 seconds each.
          const currentDelay = index < 3 ? 0 : delay += 2000;

          setTimeout(() => {
            socketManager.emitToDeliverer(deliverer.userId, 'ORDER_BROADCAST', personalizedPayload);
            this.repository.logBroadcastOffer(order.id, deliverer.userId).catch(console.error);
          }, currentDelay);
        }
      });

    } catch (error) {
      console.error(`🔥 [DISPATCH ERROR]:`, error);
    }
  }

   async getDelivererMetrics(userId, targetdelivererId, userRole) {
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