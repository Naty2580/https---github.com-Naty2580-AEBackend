import { calculateDistance } from '../../core/utils/pricing.utils.js';

export class PricingService {
  calculateDeliveryFee(meters) {
    if (meters <= 700) return 33;
    if (meters <= 1200) return 40;
    return 50;
  }

  calculateServiceFee(subtotal) {
    return Math.max(3, subtotal * 0.08);
  }

  calculateTotals(subtotal, distanceInMeters, tip = 0) {
    const deliveryFee = this.calculateDeliveryFee(distanceInMeters);
    const serviceFee = this.calculateServiceFee(subtotal);
    const total = subtotal + deliveryFee + serviceFee + tip;
    
    return { 
      subtotal, 
      deliveryFee, 
      serviceFee, 
      tip, 
      total,
      payoutAmount: subtotal + deliveryFee + tip // Amount the Deliverer receives
    };
  }
}