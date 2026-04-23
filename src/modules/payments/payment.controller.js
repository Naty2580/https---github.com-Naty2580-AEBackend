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