import { DispatchRepository } from './dispatch.repository.js';
import { calculateDistance } from '../../core/utils/pricing.utils.js';


export class DispatchService {
  constructor() {
    this.repository = new DispatchRepository();
  }

  async acceptOrder(orderId, delivererId) {
    // 1. Atomic DB assignment
    const order = await this.repository.lockAndAssignOrder(orderId, delivererId);
    
    // 2. Logic to Notify system (via WebSocket/EventBus)
    // Example: eventBus.emit('ORDER_ASSIGNED', { orderId, delivererId });
    
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
}