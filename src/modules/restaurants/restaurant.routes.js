import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import { validate } from '../../api/middlewares/validate.middleware.js';
import {
  createRestaurantSchema, updateRestaurantSchema,
  queryRestaurantSchema, toggleStatusSchema, restaurantIdParamSchema
} from './restaurant.dto.js';
import * as controller from './restaurant.controller.js';

const router = Router();

router.use(protect);

router.get('/', validate(queryRestaurantSchema), controller.list);
router.get('/:id', validate(restaurantIdParamSchema), controller.getDetails);

router.post('/',
  restrictTo('ADMIN'), // Only Admins can register new restaurants
  validate(createRestaurantSchema),
  controller.create
);
router.delete(
  '/:id',
  restrictTo('ADMIN'),
  validate(restaurantIdParamSchema),
  controller.decommission
);


router.patch(
  '/:id/status',
  restrictTo('VENDOR_STAFF', 'ADMIN'),
  validate(toggleStatusSchema),
  controller.updateStatus
);
router.patch('/:id', restrictTo('ADMIN', 'VENDOR_STAFF'), validate(updateRestaurantSchema), controller.update)


export default router;