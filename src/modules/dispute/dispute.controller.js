import { DisputeRepository } from './dispute.repository.js';
const repository = new DisputeRepository();

export const listDisputes = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const result = await repository.findAll({ skip, take: limit, status: req.query.status });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};