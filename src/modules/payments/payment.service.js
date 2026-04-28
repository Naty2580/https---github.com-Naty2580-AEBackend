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

        // 4. Normal Happy Path
        if (order.status !== 'AWAITING_PAYMENT') {
          // This should never happen unless a Deliverer bypassed state
          console.error(`[WEBHOOK ERROR] Order ${orderId} is in illegal state ${order.status}.`);
          throw new Error('ILLEGAL_STATE');
        }

        // Update status to PAYMENT_RECEIVED
        const updated = await tx.order.update({
          where: { id: orderId },
          data: { status: 'PAYMENT_RECEIVED', paymentStatus: 'CAPTURED', chapaRef }
        });

        await tx.orderStatusHistory.create({
          data: { orderId, newStatus: 'PAYMENT_RECEIVED', changedById: order.customerId }
        });

        // Trigger Escrow
        await this.ledgerService.processFinancialEvent(
          updated, 'ESCROW_RESERVE', updated.totalAmount, updated.customerId, tx
        );
      });
    } catch (error) {
      console.error(`🔥 [WEBHOOK FAILURE] Order ${orderId}:`, error);
      throw error;
    }
  }

   async initializePayment(customerId, orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: { include: { user: true } } }
    });

    if (!order) throw new NotFoundError('Order not found.');
    if (order.customerId !== customerId) throw new ForbiddenError('Unauthorized access to this order.');
    if (order.status !== 'ASSIGNED') throw new BusinessLogicError('Order is not ready for payment. Waiting for a deliverer to accept.');
    if (order.paymentStatus !== 'AWAITING_PAYMENT') throw new BusinessLogicError('Payment has already been processed or cancelled.');

    // Prepare Chapa Payload
    const payload = {
      amount: Number(order.totalAmount).toString(),
      currency: "ETB",
      email: order.customer.user.email || order.customer.user.astuEmail,
      first_name: order.customer.user.fullName,
      last_name: "ASTU", // Placeholder if single name provided
      phone_number: order.customer.user.phoneNumber,
      tx_ref: `TXN-${order.shortId}-${Date.now()}`,
      callback_url: `${config.FRONTEND_URL}/orders/${order.id}/success`, // Redirect customer here after payment
      return_url: `${config.FRONTEND_URL}/orders/${order.id}/success`,
      "customization[title]": "ASTU Eats Delivery",
      "customization[description]": `Payment for order ${order.shortId}`
    };

    try {
      // In a real production system, this calls the Chapa API.
      // For this implementation, we simulate the API call to avoid breaking the local dev environment.
      
      /* Real Implementation:
      const response = await axios.post('https://api.chapa.co/v1/transaction/initialize', payload, {
        headers: { Authorization: `Bearer ${config.CHAPA_SECRET_KEY}` }
      });
      return response.data.data.checkout_url;
      */

      console.log(`[PAYMENT SIMULATION] Initializing Chapa checkout for ${payload.amount} ETB. Ref: ${payload.tx_ref}`);
      
      // Simulate Chapa returning a checkout URL
      return `https://checkout.chapa.co/checkout/payment/${payload.tx_ref}`;

    } catch (error) {
      console.error('Chapa Initialization Error:', error.response?.data || error.message);
      throw new Error('Failed to initialize payment gateway.');
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