import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import { validate } from '../../api/middlewares/validate.middleware.js';
import {
  createRestaurantSchema, updateRestaurantSchema,
  queryRestaurantSchema, toggleStatusSchema
} from './restaurant.dto.js';
import { createCategorySchema, updateCategorySchema, deleteCategorySchema, } from '../menus/categories.dto.js';
import * as controller from './restaurant.controller.js';
import * as categoryController from '../menus/categories.controller.js';

const router = Router();

router.use(protect);

router.get('/', validate(queryRestaurantSchema), controller.list);
router.get('/:id', controller.getDetails);

router.post('/',
  restrictTo('ADMIN'), // Only Admins can register new restaurants
  validate(createRestaurantSchema),
  controller.create
);
router.delete(
  '/:id',
  restrictTo('ADMIN'),
  controller.decommission
);


router.patch(
  '/:id/status', 
  restrictTo('VENDOR_STAFF', 'ADMIN'), 
  validate(toggleStatusSchema), 
  controller.updateStatus
);
router.patch('/:id', restrictTo('ADMIN', 'VENDOR_STAFF'), validate(updateRestaurantSchema), controller.update)


router.get('/:restaurantId/categories', categoryController.list);

router.post(
  '/:restaurantId/categories',
  restrictTo('ADMIN', 'VENDOR_STAFF'),
  validate(createCategorySchema),
  categoryController.create
);

router.patch(
  '/:restaurantId/categories/:categoryId',
  restrictTo('ADMIN', 'VENDOR_STAFF'),
  validate(updateCategorySchema),
  categoryController.update
);

router.delete(
  '/:restaurantId/categories/:categoryId',
  restrictTo('ADMIN', 'VENDOR_STAFF'),
  validate(deleteCategorySchema),
  categoryController.remove
);


export default router;