import { OrderWorkflowService } from './orders.workflow.service.js';

const workflowService = new OrderWorkflowService();

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