import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import { validate } from '../../api/middlewares/validate.middleware.js';
import { acceptOrderSchema , liveLocationSchema} from './dispatch.dto.js';
import * as dispatchController from './dispatch.controller.js';

const router = Router();

router.use(protect);

// Deliverer accepts the broadcasted order
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