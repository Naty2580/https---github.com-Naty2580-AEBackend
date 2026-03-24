import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import { validate } from '../../api/middlewares/validate.middleware.js';
import { createCategorySchema, updateCategorySchema, deleteCategorySchema, reorderCategoriesSchema } from './categories.dto.js';
import { createMenuItemSchema, updateMenuItemSchema, deleteMenuItemSchema, toggleItemAvailabilitySchema, queryMenuItemsSchema, bulkToggleAvailabilitySchema } from './menu.dto.js';
import * as categoryController from './categories.controller.js';
import * as menuController from './menu.controller.js';



const router = Router({ mergeParams: true }); 

router.use(protect);


router.get('/categories', categoryController.list);

router.post(
  '/categories',
  restrictTo('ADMIN', 'VENDOR_STAFF'),
  validate(createCategorySchema),
  categoryController.create
);

router.patch('/categories/reorder', restrictTo('ADMIN', 'VENDOR_STAFF'), validate(reorderCategoriesSchema), categoryController.reorder);

router.patch(
  '/categories/:categoryId',
  restrictTo('ADMIN', 'VENDOR_STAFF'),
  validate(updateCategorySchema),
  categoryController.update
);

router.delete(
  '/categories/:categoryId',
  restrictTo('ADMIN', 'VENDOR_STAFF'),
  validate(deleteCategorySchema),
  categoryController.remove
);

// ==========================================
// MENU ITEM MANAGEMENT
// ==========================================

router.get('/items', validate(queryMenuItemsSchema), menuController.listItems);


router.post(
  '/items',
  restrictTo('ADMIN', 'VENDOR_STAFF'),
  validate(createMenuItemSchema),
  menuController.create
);

router.patch(
  '/items/:itemId',
  restrictTo('ADMIN', 'VENDOR_STAFF'),
  validate(updateMenuItemSchema),
  menuController.update
);

router.patch(
  '/items/:itemId/availability',
  restrictTo('ADMIN', 'VENDOR_STAFF'),
  validate(toggleItemAvailabilitySchema),
  menuController.toggleAvailability
);

router.patch(
  '/items/bulk-availability',
  restrictTo('ADMIN', 'VENDOR_STAFF'),
  validate(bulkToggleAvailabilitySchema),
  menuController.bulkToggleAvailability
);

router.delete(
  '/items/:itemId',
  restrictTo('ADMIN', 'VENDOR_STAFF'),
  validate(deleteMenuItemSchema),
  menuController.remove
);


export default router;