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
    // 1. Atomic DB assignment
    const order = await this.repository.atomicAssignOrder(orderId, delivererId);
    
    // 2. Start the 5-minute payment countdown
    timeoutService.schedulePaymentTimeout(orderId, order.customerId); // Pass customerId for tracking
    
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
      console.log(`📡 [DISPATCH] Broadcasting Order ${order.id} to nearby deliverers...`);

      // 1. Fetch the restaurant location to center the search
      const restaurant = order.restaurant;

      // 2. Fetch all online deliverers within a broad bounding box (BBox)
      const potentialDeliverers = await this.repository.findNearbyDeliverers(restaurant.lat, restaurant.lng);

      // 3. Geospatial Filter: Strict 1.8km Haversine distance check
      const eligibleDeliverers = potentialDeliverers.filter(deliverer => {
        // In a full production system, deliverers ping their live location to the server.
        // For this V1, we assume their 'defaultDormBlock' or a stored 'lastKnownLat' is on their profile.
        // Here we simulate the distance check. If they haven't shared location, they don't get the broadcast.
        if (!deliverer.lat || !deliverer.lng) return false;

        const distanceMeters = calculateDistance(
          restaurant.lat, 
          restaurant.lng, 
          deliverer.lat, 
          deliverer.lng
        );
        
        return distanceMeters <= CAMPUS_CONFIG.MAX_RADIUS_METERS;
      });

      if (eligibleDeliverers.length === 0) {
        console.warn(`⚠️ [DISPATCH] No eligible deliverers found for Order ${order.id}.`);
        // The 15-minute SLA timer (already started in OrderService) will eventually cancel it.
        return;
      }

      // 4. Assemble the Broadcast Payload (Hide sensitive customer data)
      const broadcastPayload = {
        orderId: order.id,
        shortId: order.shortId,
        restaurantName: restaurant.name,
        restaurantLocation: restaurant.location,
        deliveryFee: order.deliveryFee, // This is what the deliverer earns (plus tip)
        tip: order.tip,
        totalPayout: Number(order.deliveryFee) + Number(order.tip),
        distanceToRestaurant: 'Calculating...', // Frontend can compute precise distance
        createdAt: order.createdAt
      };

      // 5. Push the event via WebSockets to each eligible deliverer
      let pingCount = 0;
      eligibleDeliverers.forEach(deliverer => {
        // Check if this specific user is actually connected to the WebSocket server right now
        if (socketManager.connectedDeliverers.has(deliverer.userId)) {
          socketManager.emitToDeliverer(deliverer.userId, 'ORDER_BROADCAST', broadcastPayload);
          pingCount++;
          
          // Optional: Write to DispatchLog that we offered this order to this deliverer
          // This allows you to track "Acceptance Rate" later
          this.repository.logBroadcastOffer(order.id, deliverer.userId).catch(console.error);
        }
      });

      console.log(`✅ [DISPATCH] Order ${order.id} broadcasted to ${pingCount} live deliverers.`);

    } catch (error) {
      console.error(`🔥 [DISPATCH ERROR] Failed to broadcast order ${order.id}:`, error);
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
  
}