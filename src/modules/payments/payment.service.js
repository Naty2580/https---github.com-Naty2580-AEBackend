import prisma from '../../infrastructure/database/prisma.client.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { ChapaAdapter } from '../../infrastructure/payment/chapa.adapter.js';
import config from '../../config/env.config.js';
import crypto from 'node:crypto';
import { NotFoundError, BusinessLogicError, ForbiddenError } from '../../core/errors/domain.errors.js';

export class PaymentService {
  constructor() {
    this.ledgerService = new LedgerService();
  }

  async initializePayment(userId, userEmail, userFullName, orderId) {

    
const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customerProfile: true }
    });

     if (!user || !user.customerProfile) {
      throw new BusinessLogicError("Customer profile not found. Cannot place order.");
    }
    const cusId = user.customerProfile.id;

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) throw new NotFoundError('Order not found');
    if (order.customerId !== cusId) throw new ForbiddenError('Unauthorized access to this order.');
    if (order.status !== 'ASSIGNED') throw new BusinessLogicError('Order is not ready for payment. Waiting for a deliverer to accept.');
    if (order.paymentStatus !== 'AWAITING_PAYMENT') throw new BusinessLogicError('Payment has already been processed or cancelled.');

    // Generate unique transaction reference
    const txRef = `AE-TXN-${order.shortId}-${crypto.randomBytes(4).toString('hex')}`;

    const chapaData = {
      amount: Number(order.totalAmount).toString(), // RESTORED: Dynamic Pricing
      currency: 'ETB',
      email: userEmail,
      first_name: userFullName,
      last_name: "ASTU",
      tx_ref: txRef,
      callback_url: `${config.FRONTEND_URL}/orders/${order.id}/tracking`, 
      return_url: `${config.FRONTEND_URL}/orders/${order.id}/tracking`,
      "customization[title]": "ASTU Eats Delivery",
      "customization[description]": `Payment for order ${order.shortId}`
    };

    // Initialize with Chapa
    const chapaResponse = await ChapaAdapter.initializeTransaction(chapaData);

    // RESTORED: Must save txRef to database so Webhook can find it later
    await prisma.order.update({
      where: { id: orderId },
      data: { chapaRef: txRef }
    });

    return chapaResponse.data.checkout_url;
  }

  // RESTORED OUR PREVIOUS, BULLETPROOF OCC WEBHOOK LOGIC
  async handlePaymentSuccess(chapaRef) {
    try {
      await prisma.$transaction(async (tx) => {
        // Lock the row by chapaRef
        const [order] = await tx.$queryRaw`
          SELECT id, status, "paymentStatus", "totalAmount", "customerId" 
          FROM "Order" 
          WHERE "chapaRef" = ${chapaRef} 
          FOR UPDATE;
        `;

        if (!order) {
          console.warn(`[WEBHOOK WARNING] No order found for tx_ref: ${chapaRef}`);
          return;
        }

        if (order.paymentStatus === 'CAPTURED') return; 

        const profile = await tx.customerProfile.findUnique({
          where: { id: order.customerId },
          select: { userId: true }
        });

        if (!profile) {
          console.error(`[WEBHOOK ERROR] No CustomerProfile found for id: ${order.customerId}`);
          return;
        }

        const rootUserId = profile.userId;

        // Phantom Cancellation Edge Case
        if (order.status === 'CANCELLED' || order.status === 'NO_DELIVERER_FOUND') {

          console.warn(`[WEBHOOK CONFLICT] Order ${order.id} was already cancelled. Triggering physical refund.`);

          await tx.order.update({
            where: { id: order.id },
            data: { paymentStatus: 'REFUNDED' }
          });
          await this.ledgerService.processFinancialEvent(order, 'ESCROW_RESERVE', order.totalAmount, rootUserId, tx);
          await this.ledgerService.processFinancialEvent(order, 'REFUND', order.totalAmount, rootUserId, tx);

          ChapaAdapter.issueRefund(chapaRef, order.totalAmount).catch(e => {
            console.error(`🔥 [CRITICAL] Physical refund failed for Order ${order.id}. Requires manual intervention.`, e);
          });
          
          return;
        }

        if (order.status !== 'AWAITING_PAYMENT' && order.status !== 'ASSIGNED') {
          throw new Error(`ILLEGAL_STATE: ${order.status}`);
        }

        const updated = await tx.order.update({
          where: { id: order.id },
          data: { status: 'PAYMENT_RECEIVED', paymentStatus: 'CAPTURED', chapaRef: chapaRef }
        });

        await tx.orderStatusHistory.create({
          data: { orderId: order.id, newStatus: 'PAYMENT_RECEIVED', changedById: rootUserId }
        });

        await this.ledgerService.processFinancialEvent(
          updated, 'ESCROW_RESERVE', updated.totalAmount, rootUserId, tx
        );
      });
    } catch (error) { 
      if (error.code !== 'P2025') throw error;
    }
  }

  async disimburseDelivererPayout(orderId) {

    const order = await prisma.order.findUnique({
      where: {id: orderId},
      include: {
        deliverer: {
          include: { user: true }
        }
      }
    })

    if (!order.deliverer || !order.deliverer.payoutAccount) {
      console.warn(`Can not payout Order ${orderId}: Deliverer missing or has not payout account`)
      return
    }

    const payoutAmount = Number(order.foodPrice) + Number(order.deliveryFee) + Number(order.tip)

    const transferRef = `AE-PAYOUT-${crypto.randomBytes(6).toString('hex')}`

    const payoutData = {
      accountName: order.deliverer.user.fullname,
      accountNumber: order.deliverer.payoutAccount,
      amount: payoutAmount.toString(),
      currency: 'ETB',
      reference: transferRef,
      bank_code: order.deliverer.payoutProvider,
    }

    try {
      await chapaAdapter.transferFunds(payoutData)

      await prisma.$transaction(async (tx) => {
        await this.ledgerService.processFinancialEvent(
          order,
          'REIMBURSEMENT_PAYMENT',
          payoutAmount,
          order.deliverer.userId,
          tx
        )
        await tx.ledgerEntry.updateMany({
          where: {type: 'REIMBURSEMENT_PAYMENT', orderId: orderId},
          data: {transferRef}
        })
      })
    } catch (error) {
      console.error('Failed to disburse deliverer pay', error);
    }
  }
}