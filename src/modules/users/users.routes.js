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
import { toggleBookmarkSchema, queryBookmarksSchema } from './bookmarks.dto.js';
import { createTicketSchema, resolveTicketSchema } from './support.dto.js';

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
 *     summary: Change Password
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
 *         description: Password changed successfully
 */
router.patch('/me/password', validate(changePasswordSchema), userController.changePassword);

/**
 * @openapi
 * /users/me:
 *   delete:
 *     summary: Deactivate Account
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Account deactivated
 */
router.delete('/me', validate(deactivateAccountSchema), userController.deactivateMe);
/**
 * @openapi
 * /users/me/toggle-mode:
 *   patch:
 *     summary: Toggle between Student/Vendor Mode
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isVendorMode:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Mode toggled successfully
 */
router.patch('/me/toggle-mode', validate(toggleModeSchema), userController.toggleMode);

/**
 * @openapi
 * /users/me/availability:
 *   patch:
 *     summary: Set Availability (for Deliverers/Vendors)
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
 *     summary: Update Payout Information (for Vendors)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bankName:
 *                 type: string
 *               bankAccountNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payout info updated
 */
router.patch('/me/payout', validate(updatePayoutSchema), userController.updatePayout);

// Deliverer Application Flow (Only Students)

router.post(
  '/me/deliverer-application',
  restrictTo('CUSTOMER'),
  validate(applyDelivererSchema),
  userController.applyDeliverer
);



// ==========================================
// BOOKMARKS
// ==========================================
router.post('/me/bookmarks', validate(toggleBookmarkSchema), userController.toggleBookmark);
router.get('/me/bookmarks', validate(queryBookmarksSchema), userController.getBookmarks);

// ==========================================
// SUPPORT TICKETS
// ==========================================
router.post('/me/tickets', validate(createTicketSchema), userController.createTicket);
router.get('/me/tickets', userController.listTickets);

// ADMIN ONLY
router.patch(
  '/tickets/:id/resolve', 
  restrictTo('ADMIN'), 
  validate(resolveTicketSchema), 
  userController.updateTicketStatus
);


// ==========================================
// ADMIN ROUTES
// ==========================================

/**
 * @openapi
 * /users:
 *   get:
 *     summary: List all users with filters (Admin only)
 *     tags: [Admin - User Management]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [CUSTOMER, DELIVERER, VENDOR_STAFF, ADMIN] }
 *       - in: query
 *         name: status
 *         schema: { type: string, example: "ACTIVE" }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name or email
 *     responses:
 *       200: { description: List of users retrieved }
 */
router.get(
  '/',
  restrictTo('ADMIN'),
  validate(userQuerySchema),
  userController.listUsers
);

/**
 * @openapi
 * /users/applications/deliverers:
 *   get:
 *     summary: List pending deliverer applications (Admin only)
 *     tags: [Admin - User Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200: { description: List of pending deliverer applications }
 */
router.get(
  '/applications/deliverers',
  restrictTo('ADMIN'),
  userController.getPendingDelivererApplications
);

/**
 * @openapi
 * /users/applications/vendors:
 *   get:
 *     summary: List pending vendor applications (Admin only)
 *     tags: [Admin - User Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200: { description: List of pending vendor applications }
 */
router.get(
  '/applications/vendors',
  restrictTo('ADMIN'),
  userController.getPendingVendorApplications
);

/**
 * @openapi
 * /users/{userId}/status:
 *   patch:
 *     summary: Ban or Activate a user account (Admin only)
 *     tags: [Admin - User Management]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [ACTIVE, BANNED] }
 *               reason: { type: string }
 *     responses:
 *       200: { description: User status updated }
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
 *     summary: Review a Deliverer application (Admin only)
 *     tags: [Admin - Verification]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [APPROVED, REJECTED, REVOKED] }
 *               reason: { type: string }
 *     responses:
 *       200: { description: Deliverer status updated }
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
 *     summary: Review a Vendor application (Admin only)
 *     tags: [Admin - Verification]
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [APPROVED, REJECTED, REVOKED] }
 *               reason: { type: string }
 *     responses:
 *       200: { description: Vendor status updated }
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
 *     summary: Assign a user to a restaurant staff (Admin only)
 *     tags: [Admin - User Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, restaurantId]
 *             properties:
 *               userId: { type: string, format: uuid }
 *               restaurantId: { type: string, format: uuid }
 *               isOwner: { type: boolean, default: false }
 *     responses:
 *       200: { description: Staff assigned }
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
 *     summary: Fetch all users without pagination (Admin only)
 *     tags: [Admin - User Management]
 *     responses:
 *       200: { description: All users retrieved }
 */
router.get('/fetchAllUsers', userController.fetchAllUsers);

export default router; 