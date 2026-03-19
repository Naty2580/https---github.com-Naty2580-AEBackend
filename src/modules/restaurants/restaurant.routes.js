// import express from 'express';
// import * as restaurantController from './restaurants.controller.js';
// import { protect } from '../../middlewares/authMiddleware.js';
// import { authorize } from '../../middlewares/roleMiddleware.js';
// import { validate } from '../../middlewares/validate.js';
// import { 
//   createRestaurantSchema, 
//   createCategorySchema, 
//   createProductSchema 
// } from './restaurants.schema.js';

// const router = express.Router();

// // PUBLIC ROUTES
// router.get('/', restaurantController.getRestaurants);
// router.get('/:id/menu', restaurantController.getMenu);

// // ADMIN ONLY: Create Restaurant
// router.post('/', 
//   protect, 
//   authorize('ADMIN'), 
//   validate(createRestaurantSchema), 
//   restaurantController.createRestaurant
// );

// // VENDOR/ADMIN: Manage Menu
// router.post('/:restaurantId/categories', 
//   protect, 
//   authorize('VENDOR', 'ADMIN'), 
//   validate(createCategorySchema), 
//   restaurantController.createCategory
// );

// router.post('/:restaurantId/products', 
//   protect, 
//   authorize('VENDOR', 'ADMIN'), 
//   validate(createProductSchema), 
//   restaurantController.createProduct
// );

// export default router;

import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import { validate } from '../../api/middlewares/validate.middleware.js';
import { createRestaurantSchema } from './restaurant.dto.js';
import * as controller from './restaurant.controller.js';

const router = Router();

router.post('/', 
  protect, 
  restrictTo('ADMIN'), // Only Admins can register new restaurants
  validate(createRestaurantSchema), 
  controller.create
);
router.patch('/:id/status', protect, restrictTo('VENDOR_STAFF', 'ADMIN'), controller.updateStatus);
router.patch('/:id', protect, restrictTo('VENDOR_STAFF', 'ADMIN'), controller.update);

router.get('/', controller.getAll);
router.get('/:id', controller.getDetails);

export default router;