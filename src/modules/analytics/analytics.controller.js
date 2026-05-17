import { AnalyticsService } from './analytics.service.js';

const analyticsService = new AnalyticsService();

export const getDashboardData = async (req, res, next) => {
  try {
    const data = await analyticsService.getDashboardData();
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};
