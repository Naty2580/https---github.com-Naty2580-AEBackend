import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import { validate } from '../../api/middlewares/validate.middleware.js';
import { acceptOrderSchema } from './dispatch.dto.js';
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

export default router;