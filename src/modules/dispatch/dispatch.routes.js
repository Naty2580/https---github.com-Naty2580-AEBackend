import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import { validate } from '../../api/middlewares/validate.middleware.js';
import { acceptOrderSchema , liveLocationSchema} from './dispatch.dto.js';
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


router.get(
  '/metrics/:delivererId',
  restrictTo('DELIVERER', 'ADMIN'),
  dispatchController.getMetrics
);

// NEW: High-frequency telemetry endpoint for the Deliverer App
router.post(
  '/live-location',
  restrictTo('DELIVERER'),
  validate(liveLocationSchema),
  dispatchController.updateLiveLocation
);
export default router;