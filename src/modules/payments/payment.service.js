import { email } from 'zod';
import prisma from '../../infrastructure/database/prisma.client.js';
import { LedgerService } from '../ledger/ledger.service.js';
import chapaAdapter from '../../infrastructure/payment/chapa.adapter.js'

export class PaymentService {
  constructor() {
    this.ledgerService = new LedgerService();
  }

  async initializePayment(orderId, user) {
    const order = await prisma.order.findUnique({
      where: {id: orderId}
    })

    if (!order) {
      throw new Error('Order not found')
    }
    if (order.status !=='CREATED' && order.status !== 'AWAITING_PAYMENT') {
      throw new Error('Order is not in a state to be paid for')
    }

    const txRef = `AE-TX${crypto.randomBytes(8).toString('hex')}`

    const chapaData = {
      amount: order.totalAmount.toString(),
      currency: 'ETB',
      email: user.email || 'customer@astu.edu.et',
      first_name: user.fullname,
      last_name: 'Customer',
      tx_ref: txRef,
      // callback_url: `${process.env.BASE_URL}/api/v1/payments/verify`
    }

    const chapaResponse = await chapaAdapter.initializePayment(chapaData)

    await prisma.order.update({
      where: {id: orderId},
      data: { chapaRef: txRef }
    })

    return chapaResponse.data.checkout_url
  }

  async handlePaymentSuccess(chapaRef) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { chapaRef } });

      if (!order) {
        console.error(`Webhook matched no order for tx_ref: ${chapaRef}`);
        return;
      }
      
      // Idempotency check
      if (order.status === 'PAYMENT_RECEIVED') return;

      // 1. Transition Order Status
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'PAYMENT_RECEIVED', paymentStatus: 'CAPTURED', chapaRef }
      });

      // 2. Trigger Ledger entry (The Escrow Reserve)
      await this.ledgerService.processFinancialEvent(
        order, 
        'ESCROW_RESERVE', 
        order.totalAmount, 
        order.customerId, 
        tx
      );
    });
  }
}