import { DisputeService } from './dispute.service.js';

const disputeService = new DisputeService();

export const listDisputes = async (req, res, next) => {
  try {
    const result = await disputeService.listDisputes(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const resolveDispute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    await disputeService.resolveDispute(id, adminId, req.body);
    
    res.status(200).json({
      success: true,
      message: "Dispute resolved successfully."
    });
  } catch (error) {
    next(error);
  }
};