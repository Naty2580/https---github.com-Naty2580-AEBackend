import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import * as analyticsController from './analytics.controller.js';

const router = Router();

router.use(protect);

/**
 * @openapi
 * /analytics/dashboard:
 *   get:
 *     summary: Retrieve comprehensive platform analytics for the admin dashboard
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved dashboard analytics data.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden. Only ADMIN can access this.
 */
router.get('/dashboard', restrictTo('ADMIN'), analyticsController.getDashboardData);

export default router;
