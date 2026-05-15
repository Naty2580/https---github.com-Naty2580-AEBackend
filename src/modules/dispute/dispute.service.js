import { DisputeRepository } from './dispute.repository.js';
import { ChapaAdapter } from '../../infrastructure/payment/chapa.adapter.js';
import { LedgerService } from '../ledger/ledger.service.js';
import prisma from '../../infrastructure/database/prisma.client.js';

export class DisputeService {
  constructor() {
    this.repository = new DisputeRepository();
    this.ledgerService = new LedgerService();
  }

  async listDisputes(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const { total, disputes } = await this.repository.findAll({ skip, take: limit, status: query.status });

    const formattedDisputes = disputes.map(dispute => ({
      id: dispute.id,
      orderId: dispute.order?.shortId || dispute.orderId,
      raisedById: dispute.raisedById,
      raisedByName: dispute.raisedBy?.fullName || 'Unknown User',
      reason: dispute.reason,
      evidence: dispute.evidence,
      status: dispute.status,
      resolution: dispute.resolution,
      createdAt: dispute.createdAt,
      updatedAt: dispute.updatedAt
    }));

    return {
      total,
      disputes: formattedDisputes
    };
  }

  async resolveDispute(disputeId, adminId, { status, resolution, action, amount }) {
    if (!status) {
      throw new Error('Status is required to resolve a dispute.');
    }

    if (action === 'REFUND') {
      const dispute = await prisma.dispute.findUnique({
        where: { id: disputeId },
        include: { order: true }
      });

      if (!dispute || !dispute.order) throw new Error("Dispute or linked Order not found.");

      const refundAmount = amount || dispute.order.totalAmount;

      // 1. Issue physical refund via Chapa
      if (dispute.order.chapaRef) {
        await ChapaAdapter.issueRefund(dispute.order.chapaRef, refundAmount, resolution);
      }

      // 2. Adjust Ledger Records
      await prisma.$transaction(async (tx) => {
        // Log the refund in the ledger
        await this.ledgerService.processFinancialEvent(dispute.order, 'REFUND', refundAmount, dispute.raisedById, tx);
        
        // Update order and payment status
        await tx.order.update({
          where: { id: dispute.order.id },
          data: { paymentStatus: 'REFUNDED', status: 'CANCELLED' } // Cancel order since customer was refunded
        });
        
        await tx.payment.update({
          where: { orderId: dispute.order.id },
          data: { status: 'REFUNDED', refundReason: resolution }
        });
      });
    } else if (action === 'RELEASE') {
      const dispute = await prisma.dispute.findUnique({
        where: { id: disputeId },
        include: { order: true }
      });

      if (!dispute || !dispute.order) throw new Error("Dispute or linked Order not found.");

      // Dynamically import PaymentService to avoid circular dependencies if any
      const { PaymentService } = await import('../payments/payment.service.js');
      const paymentService = new PaymentService();

      await prisma.$transaction(async (tx) => {
        // Force the order to COMPLETED
        await tx.order.update({
          where: { id: dispute.order.id },
          data: { status: 'COMPLETED', paymentStatus: 'CAPTURED' }
        });

        console.log("Release dispute order id",dispute.order.id);
        
        // Ensure Payment record is marked captured
        await tx.payment.update({
          where: { orderId: dispute.order.id },
          data: { status: 'CAPTURED' }
        });
      });

      // Trigger the existing payout disimbursement logic asynchronously or wait for it
      // Note: disimburseDelivererPayout already handles the Ledger entry creation
      await paymentService.disimburseDelivererPayout(dispute.order.id);
    }

    return await this.repository.update(disputeId, {
      status,
      resolution,
      assignedAdminId: adminId
    });
  }
}
