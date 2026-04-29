import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import * as userController from './users.controller.js';
import { validate } from '../../api/middlewares/validate.middleware.js';
import {
  updateProfileSchema, applyDelivererSchema,
  updateDelivererStatusSchema, assignVendorStaffSchema, toggleModeSchema, setAvailabilitySchema,
  userQuerySchema,
  updateUserStatusSchema, updatePayoutSchema, deactivateAccountSchema, 
  changePasswordSchema, updateEmailSchema, updatePhoneSchema, updateVendorStatusSchema
} from './users.dto.js';

const router = Router();

router.use(protect);

// Self-Service Profile Management

/**
 * @openapi
 * /users/me:
 *   get:
 *     summary: Get my current profile
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Successfully retrieved user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/me', userController.getMe);

/**
 * @openapi
 * /users/me:
 *   patch:
 *     summary: Update general profile information
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               defaultLocation:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               avatarUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.patch('/me', validate(updateProfileSchema), userController.updateMyProfile);
/**
 * @openapi
 * /users/me/email:
 *   patch:
 *     summary: Request to update ASTU Email
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newEmail:
 *                 type: string
 *                 example: it.new.dev@astu.edu.et
 *     responses:
 *       200:
 *         description: Email update requested
 */
router.patch('/me/email', validate(updateEmailSchema), userController.requestEmailUpdate);
/**
 * @openapi
 * /users/me/phone:
 *   patch:
 *     summary: Request to update Phone Number
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newPhone:
 *                 type: string
 *                 example: "0911223344"
 *     responses:
 *       200:
 *         description: Phone update requested
 */
router.patch('/me/phone', validate(updatePhoneSchema), userController.requestPhoneUpdate);
/**
 * @openapi
 * /users/me/password:
 *   patch:
 *     summary: Change password
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password successfully changed
 */
router.patch('/me/password', validate(changePasswordSchema), userController.changePassword);
/**
 * @openapi
 * /users/me:
 *   delete:
 *     summary: Deactivate my account
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account deactivated
 */
router.delete('/me', validate(deactivateAccountSchema), userController.deactivateMe);

/**
 * @openapi
 * /users/me/toggle-mode:
 *   patch:
 *     summary: Switch active mode between CUSTOMER and DELIVERER
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mode
 *             properties:
 *               mode:
 *                 type: string
 *                 enum: [CUSTOMER, DELIVERER]
 *     responses:
 *       200:
 *         description: Mode successfully toggled
 */
router.patch('/me/toggle-mode', validate(toggleModeSchema), userController.toggleMode);
/**
 * @openapi
 * /users/me/availability:
 *   patch:
 *     summary: Set online/offline availability (Deliverers only)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isAvailable:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Availability updated
 */
router.patch('/me/availability', validate(setAvailabilitySchema), userController.setAvailability);
/**
 * @openapi
 * /users/me/payout:
 *   patch:
 *     summary: Update payout account details (Deliverers only)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               payoutProvider:
 *                 type: string
 *                 enum: [TELEBIRR, CBE_BIRR]
 *               payoutAccount:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payout details updated
 */
router.patch('/me/payout', validate(updatePayoutSchema), userController.updatePayout);

// Deliverer Application Flow (Only Students)

/**
 * @openapi
 * /users/me/deliverer-application:
 *   post:
 *     summary: Apply to become a deliverer
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - payoutProvider
 *               - payoutAccount
 *             properties:
 *               payoutProvider:
 *                 type: string
 *                 enum: [TELEBIRR, CBE_BIRR]
 *               payoutAccount:
 *                 type: string
 *                 example: "1000123456789"
 *     responses:
 *       200:
 *         description: Application submitted successfully
 */
router.post(
  '/me/deliverer-application',
  restrictTo('CUSTOMER'),
  validate(applyDelivererSchema),
  userController.applyDeliverer
);

// ==========================================
// ADMIN ROUTES
// ========================================== 

/**
 * @openapi
 * /users:
 *   get:
 *     summary: List all users (Admin only)
 *     tags: [Users - Admin]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [CUSTOMER, DELIVERER, VENDOR_STAFF, ADMIN]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Users listed successfully
 */
router.get(
  '/',
  restrictTo('ADMIN'),
  validate(userQuerySchema),
  userController.listUsers
);

/**
 * @openapi
 * /users/{userId}/status:
 *   patch:
 *     summary: Update a user's account status (Admin)
 *     tags: [Users - Admin]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, BANNED]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: User status updated
 */
router.patch(
  '/:userId/status',
  restrictTo('ADMIN'),
  validate(updateUserStatusSchema),
  userController.updateUserStatus
);
/**
 * @openapi
 * /users/{userId}/deliverer-status:
 *   patch:
 *     summary: Approve or Reject a Deliverer Application (Admin)
 *     tags: [Users - Admin]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED, REVOKED]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Deliverer application status updated
 */
router.patch(
  '/:userId/deliverer-status',
  restrictTo('ADMIN'),
  validate(updateDelivererStatusSchema),
  userController.reviewDeliverer
);
/**
 * @openapi
 * /users/{vendorId}/vendor-status:
 *   patch:
 *     summary: Approve or Reject a Vendor Application (Admin)
 *     tags: [Users - Admin]
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED, REVOKED]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Vendor application status updated
 */
router.patch(
  '/:vendorId/vendor-status',
  restrictTo('ADMIN'),
  validate(updateVendorStatusSchema),
  userController.reviewVendor
);
/**
 * @openapi
 * /users/assign-vendor:
 *   post:
 *     summary: Link a user account to a specific restaurant (Admin)
 *     tags: [Users - Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - restaurantId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               restaurantId:
 *                 type: string
 *                 format: uuid
 *               isOwner:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Staff member assigned to restaurant
 */
router.post(
  '/assign-vendor',
  restrictTo('ADMIN'),
  validate(assignVendorStaffSchema),
  userController.assignVendorStaff
);



/**
 * @openapi
 * /users/fetchAllUsers:
 *   get:
 *     summary: Fetch a raw list of all users
 *     tags: [Users - Admin]
 *     responses:
 *       200:
 *         description: All users fetched
 */
router.get('/fetchAllUsers', userController.fetchAllUsers);

export default router; 