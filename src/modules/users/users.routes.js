import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import * as userController from './users.controller.js';
import { validate } from '../../api/middlewares/validate.middleware.js';
import {
  updateProfileSchema, applyDelivererSchema,
  updateDelivererStatusSchema, assignVendorStaffSchema, toggleModeSchema, setAvailabilitySchema,
  userQuerySchema,
  updateUserStatusSchema, updatePayoutSchema, deactivateAccountSchema, changePasswordSchema
} from './users.dto.js';

const router = Router();

router.use(protect);

// Self-Service Profile Management
router.get('/me', userController.getMe);
router.patch('/me', validate(updateProfileSchema), userController.updateMyProfile);
router.patch('/me/password', validate(changePasswordSchema), userController.changePassword);
router.delete('/me', validate(deactivateAccountSchema), userController.deactivateMe);
router.patch('/me/toggle-mode', validate(toggleModeSchema), userController.toggleMode);
router.patch('/me/availability', validate(setAvailabilitySchema), userController.setAvailability);
router.patch('/me/payout', validate(updatePayoutSchema), userController.updatePayout);

// Deliverer Application Flow (Only Students)
router.post(
  '/me/deliverer-application',
  restrictTo('CUSTOMER'),
  validate(applyDelivererSchema),
  userController.applyDeliverer
);

// ==========================================
// ADMIN ROUTES
// ==========================================
router.get(
  '/',
  restrictTo('ADMIN'),
  validate(userQuerySchema),
  userController.listUsers
);
router.patch(
  '/:userId/status',
  restrictTo('ADMIN'),
  validate(updateUserStatusSchema),
  userController.updateUserStatus
);
router.patch(
  '/:userId/deliverer-status',
  restrictTo('ADMIN'),
  validate(updateDelivererStatusSchema),
  userController.reviewDeliverer
);
router.post(
  '/assign-vendor',
  restrictTo('ADMIN'),
  validate(assignVendorStaffSchema),
  userController.assignVendorStaff
);



router.get('/fetchAllUsers', userController.fetchAllUsers);

export default router;