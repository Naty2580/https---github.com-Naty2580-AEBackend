import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import { validate } from '../../api/middlewares/validate.middleware.js';
import { createCategorySchema, createMenuItemSchema } from './menu.dto.js';
import * as controller from './menu.controller.js';

const router = Router();

// Only VENDOR_STAFF or ADMIN can create menu items
router.post('/categories', protect, restrictTo('VENDOR_STAFF', 'ADMIN'), validate(createCategorySchema), controller.addCategory);
router.post('/items', protect, restrictTo('VENDOR_STAFF', 'ADMIN'), validate(createMenuItemSchema), controller.addItem);

export default router;