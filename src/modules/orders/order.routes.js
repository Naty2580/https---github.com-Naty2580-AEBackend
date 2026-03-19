import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import * as controller from './orders.controller.js';

const router = Router();

router.use(protect);

// Deliverer accepting an order
router.post('/:id/accept', restrictTo('DELIVERER'), controller.acceptOrder);

// Vendor/Deliverer status updates
router.patch('/:id/status', controller.updateStatus);

export default router;