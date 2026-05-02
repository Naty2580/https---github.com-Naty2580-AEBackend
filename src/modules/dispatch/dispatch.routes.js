import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import { validate } from '../../api/middlewares/validate.middleware.js';
import { acceptOrderSchema } from './dispatch.dto.js';
import * as dispatchController from './dispatch.controller.js';

const router = Router();

router.use(protect);

// Deliverer accepts the broadcasted order
/**
 * @openapi
 * /dispatch/{orderId}/accept:
 *   post:
 *     summary: Deliverer accepts an order
 *     tags: [Dispatch]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Order accepted successfully }  
 */
router.post(
  '/:orderId/accept', 
  restrictTo('DELIVERER'), 
  validate(acceptOrderSchema), 
  dispatchController.acceptOrder
);

/**
 * @openapi
 * /dispatch/metrics/{delivererId}:
 *   get:
 *     summary: Get metrics for a deliverer
 *     tags: [Dispatch]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: delivererId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Metrics retrieved successfully }  
 */
router.get(
  '/metrics/:delivererId',
  restrictTo('DELIVERER', 'ADMIN'),
  dispatchController.getMetrics
);

export default router;