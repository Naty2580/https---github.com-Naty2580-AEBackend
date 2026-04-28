import { chapaAdapter } from "../../infrastructure/payment/chapa.adapter.js"
import { PaymentService } from "./payment.service.js"

const paymentService = new PaymentService()

export class PaymentController {

    async initialize(req, res, next) {
        try {
            const { orderId } = req.body
            const user = req.user

            const checkout_url = await paymentService.initializePayment(orderId, user)
            res.status(200).json({success: true, url: checkout_url})
        } catch (error) {
            next(error)
        }
    }

    async chapaWebhook(req, res, next) {
        try {
            const signiture = req.headers['x-chapa-signiture']

            if (!chapaAdapter.verifyWebhookSignature(signiture, req.body)) {
                return res.status(401).send('Invalid sifniture')
            }

            const {tx_ref, status} = req.body

            if (status === 'success') {
                await paymentService.handlePaymentSuccess(tx_ref)
            }

            res.status(200).send('Webhook Recieved')
        } catch (error) {
            console.error('Webhook Error', error)
            res.status(500).send('Webhook processing error')
        }
    }
}
import { PaymentService } from './payment.service.js';

const paymentService = new PaymentService();

export const initiateCheckout = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const checkoutUrl = await paymentService.initializePayment(req.user.id, orderId);
    
    res.status(200).json({ 
      success: true, 
      data: { checkoutUrl } 
    });
  } catch (error) {
    next(error);
  }
};
