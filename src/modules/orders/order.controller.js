import { OrderWorkflowService } from './order.workflow.service.js';
import { OrderRepository } from './orders.repository.js';
import { OrderService } from './order.service.js';

const workflowService = new OrderWorkflowService();
const repository = new OrderRepository();
export const orderService = new OrderService(repository);

// DELIVERER: Accepts order
export const acceptOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await workflowService.acceptOrder(id, req.user.id);
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};
 
// VENDOR/DELIVERER: Updates status (PICKED_UP, READY_FOR_PICKUP, etc.)
export const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const order = await workflowService.updateStatus(id, status, req.user.id, req.user.role);
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

//
export const getDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    // We pass the user role to enforce IDOR checks inside the service
    const order = await orderService.getOrderDetails(req.user.id, req.user.role, id);
    
    res.status(200).json({ 
      success: true, 
      data: order 
    });
  } catch (error) {
    next(error);
  }
};

// 
export const cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    
    // Pass userRole down so the service can differentiate between a Customer and a Vendor cancelling
    await orderService.cancelOrder(req.user.id, req.user.role, id, reason);
    
    res.status(200).json({ 
      success: true, 
      message: 'Order cancelled successfully and escrow refunded.' 
    });
  } catch (error) {
    next(error);
  }
};


export const checkout = async (req, res, next) => {
  try {
    // Controller strictly passes req.user.id to ensure the order is tied to the authenticated token
    const order = await orderService.checkout(req.user.id, req.body);
    
    res.status(201).json({ 
      success: true, 
      message: 'Order created successfully',
      data: order 
    });
  } catch (error) {
    next(error);
  }
};

export const listOrders = async (req, res, next) => {
  try {
    const result = await orderService.listOrders(req.user.id, req.user.role, req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const vendorUpdateState = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await orderService.updateVendorState(req.user.id, req.user.role, id, status);
    res.status(200).json({ success: true, message: `Order updated to ${status}` });
  } catch (error) {
    next(error);
  }
};

export const delivererUpdateState = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await orderService.updateDelivererState(req.user.id, req.user.role, id, status);
    res.status(200).json({ success: true, message: `Order updated to ${status}` });
  } catch (error) {
    next(error);
  }
};

export const customerConfirmOTP = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { otpCode } = req.body;
    await orderService.completeOrderWithOTP(req.user.id, id, otpCode);
    res.status(200).json({ success: true, message: 'Delivery Handshake Successful.' });
  } catch (error) {
    next(error);
  }
};

export const dropOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    await orderService.delivererDropOrder(req.user.id, id, reason);
    res.status(200).json({ success: true, message: 'Order dropped and requeued.' });
  } catch (error) {
    next(error);
  }
};

export const raiseDispute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    await orderService.raiseDispute(req.user.id, req.user.role, id, reason);
    res.status(201).json({ success: true, message: 'Dispute raised. Escrow funds frozen.' });
  } catch (error) {
    next(error);
  }
};

export const getActiveDelivery = async (req, res, next) => {
  try {
    const delivery = await orderService.getActiveDelivery(req.user.id, req.user.role);
    res.status(200).json({ success: true, data: delivery });
  } catch (error) {
    next(error);
  }
};

export const getKitchenQueue = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const queue = await orderService.getKitchenQueue(req.user.id, req.user.role, restaurantId);
    res.status(200).json({ success: true, data: queue });
  } catch (error) {
    next(error);
  }
};

export const resolveDispute = async (req, res, next) => {
  try {
    const { id } = req.params; // disputeId
    const { resolution, notes } = req.body;
    await orderService.resolveDispute(req.user.id, id, resolution, notes);
    res.status(200).json({ success: true, message: `Dispute resolved via ${resolution}` });
  } catch (error) {
    next(error);
  }
};

export const retryPayout = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    await orderService.retryFailedPayout(req.user.id, orderId);
    res.status(200).json({ success: true, message: 'Payout retry executed. Check payout logs for result.' });
  } catch (error) {
    next(error);
  }
};
