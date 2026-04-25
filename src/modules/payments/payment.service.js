import { email } from 'zod';
import prisma from '../../infrastructure/database/prisma.client.js';
import { LedgerService } from '../ledger/ledger.service.js';
import {chapaAdapter} from '../../infrastructure/payment/chapa.adapter.js'
import crypto from 'node:crypto'

export class PaymentService {
  constructor() {
    this.ledgerService = new LedgerService();
  }

  async initializePayment(orderId, user) {
    const order = await prisma.order.findUnique({
      where: {id: orderId}
    })

    // if (!order) {
    //   throw new Error('Order not found')
    // }
    // if (order.status !=='CREATED' && order.status !== 'AWAITING_PAYMENT') {
    //   throw new Error('Order is not in a state to be paid for')
    // }

    const txRef = `AE-TX${crypto.randomBytes(8).toString('hex')}`

    const chapaData = {
      amount: /* order.totalAmount.toString() */ 100,
      currency: 'ETB',
      email: user.email || 'customer@astu.edu.et',
      first_name: user.fullname,
      last_name: 'Customer',
      tx_ref: txRef,
      // callback_url: `${process.env.BASE_URL}/api/v1/payments/verify`
    }

    const chapaResponse = await chapaAdapter.initializeTransaction(chapaData)

    // await prisma.order.update({
    //   where: {id: orderId},
    //   data: { chapaRef: txRef }
    // })

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