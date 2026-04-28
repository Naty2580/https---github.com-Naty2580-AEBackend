import { DispatchService } from './dispatch.service.js';

const dispatchService = new DispatchService();

export const acceptOrder = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const delivererId = req.user.id; // From Auth Middleware
    
    const order = await dispatchService.acceptOrder(orderId, delivererId);
    
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

export const getMetrics = async (req, res, next) => {
  try {
    const { delivererId } = req.params;
    const metrics = await dispatchService.getDelivererMetrics(req.user.id, delivererId, req.user.role);
    res.status(200).json({ success: true, data: metrics });
  } catch (error) {
    next(error);
  }
};