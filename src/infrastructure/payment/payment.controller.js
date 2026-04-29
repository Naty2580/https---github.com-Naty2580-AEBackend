import { PaymentService } from './payment.service.js';

const paymentService = new PaymentService();

export const initiate = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const result = await paymentService.initiatePayment(req.user.id, orderId);
    
    res.status(200).json({ 
      success: true, 
      message: 'Payment initialized',
      data: { checkoutUrl: result.checkout_url }
    });
  } catch (error) {
    next(error);
  }
};

// ... keep webhook controller