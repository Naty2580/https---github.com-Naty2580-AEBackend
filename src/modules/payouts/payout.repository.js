import prisma from '../../infrastructure/database/prisma.client.js';

export class PayoutRepository {
  /**
   * Logs an attempt to contact the Mobile Money API.
   */
  async logAttempt(orderId, status, apiResponse) {
    // If a log already exists for this order (e.g., a retry), increment the attempt counter
    const existing = await prisma.payoutLog.findFirst({ where: { orderId } });
    
    if (existing) {
      return await prisma.payoutLog.update({
        where: { id: existing.id },
        data: { 
          status, 
          apiResponse, 
          attempts: existing.attempts + 1 
        }
      });
    }

    return await prisma.payoutLog.create({
      data: { orderId, status, apiResponse, attempts: 1 }
    });
  }

  async getLogByOrderId(orderId) {
    return await prisma.payoutLog.findFirst({ where: { orderId } });
  }
}