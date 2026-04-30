import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import * as orderController from './order.controller.js';
import { validate } from '../../api/middlewares/validate.middleware.js';
import { checkoutSchema, cancelOrderSchema, orderQuerySchema, 
  updateVendorStateSchema, updateDelivererStateSchema, completeOrderSchema, dropOrderSchema, raiseDisputeSchema  } from './orders.dto.js';
  import { resolveDisputeSchema, retryPayoutSchema } from '../ledger/ledger.dto.js';

const router = Router(); 

router.use(protect);

/**
 * @openapi
 * /orders:
 *   get:
 *     summary: List all orders based on role and filters
 *     description: |
 *       Fetches orders. Behavior depends on `roleAs`:
 *       - **CUSTOMER**: Returns orders made by the authenticated user.
 *       - **DELIVERER**: Returns orders assigned to the authenticated deliverer.
 *       - **VENDOR**: Returns orders for a specific `restaurantId` (requires staff access).
 *       - **ADMIN**: Returns all orders in the system.
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: roleAs
 *         schema:
 *           type: string
 *           enum: [CUSTOMER, DELIVERER, VENDOR, ADMIN]
 *           default: CUSTOMER
 *         description: The perspective from which to list orders.
 *       - in: query
 *         name: restaurantId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Required if roleAs is VENDOR.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [CREATED, AWAITING_ACCEPT, ASSIGNED, AWAITING_PAYMENT, PAYMENT_RECEIVED, VENDOR_BEING_PREPARED, VENDOR_READY_FOR_PICKUP, PICKED_UP, EN_ROUTE, ARRIVED, COMPLETED, DISPUTED, CANCELLED]
 *         description: Filter by order status.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
 *     responses:
 *       200:
 *         description: A paginated list of orders.
 */
router.get(
  '/', 
  validate(orderQuerySchema), 
  orderController.listOrders
);

/**
 * @openapi
 * /orders/{id}/state/vendor:
 *   patch:
 *     summary: Update vendor state (e.g., READY for pickup)
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             properties:
 *               state: { type: string, enum: [READY] }
 *     responses:
 *       200: { description: Order state updated by vendor }
 */
router.patch(
  '/:id/state/vendor', 
  restrictTo('VENDOR_STAFF', 'ADMIN'), 
  validate(updateVendorStateSchema), 
  orderController.vendorUpdateState
);

/**
 * @openapi
 * /orders/{id}/state/deliverer:
 *   patch:
 *     summary: Update deliverer state (e.g., PICKED_UP, DELIVERING)
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             properties:
 *               state: { type: string, enum: [DELIVERING, COMPLETED] }
 *     responses:
 *       200: { description: Order state updated by deliverer }
 */
router.patch(
  '/:id/state/deliverer', 
  restrictTo('DELIVERER', 'ADMIN'), 
  validate(updateDelivererStateSchema), 
  orderController.delivererUpdateState
);

/**
 * @openapi
 * /orders/{id}/confirm-handshake:
 *   post:
 *     summary: Confirm order pickup/delivery with OTP
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             properties:
 *               otp: { type: string, description: 4-digit OTP }
 *     responses:
 *       200: { description: Order confirmed, payment finalized }  
 */
router.post(
  '/:id/confirm-handshake', 
  restrictTo('CUSTOMER', 'DELIVERER', 'ADMIN'), // Deliverers/Admins as customers
  validate(completeOrderSchema), 
  orderController.customerConfirmOTP
);

// Deliverer accepting an order

/**
 * @openapi
 * /orders/{id}/accept:
 *   post:
 *     summary: Deliverer accepts an available order
 *     description: |
 *       Allows a user with the **DELIVERER** role to claim an order. 
 *       - The order must be in `AWAITING_ACCEPT` status.
 *       - Once accepted, the status changes to `ASSIGNED` and the deliverer is linked to the order.
 *       - If another deliverer already accepted it, a `409 Conflict` error is returned (OCC protection).
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the order to accept.
 *     responses:
 *       200:
 *         description: Order accepted successfully.
 *       403:
 *         description: Forbidden. User is not a deliverer.
 *       404:
 *         description: Order not found.
 *       409:
 *         description: Conflict. Order was already taken by another deliverer or is no longer available.
 */
router.post('/:id/accept', restrictTo('DELIVERER'), orderController.acceptOrder);


router.post(
  '/:id/drop',
  restrictTo('DELIVERER'),
  validate(dropOrderSchema),
  orderController.dropOrder
);


/**
 * @openapi
 * /orders/active-delivery:
 *   get:
 *     summary: Get currently active delivery for the logged-in deliverer
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200: { description: Active delivery details }
 */
router.get(
  '/active-delivery',
  restrictTo('DELIVERER', 'ADMIN'),
  orderController.getActiveDelivery
);


/**
 * @openapi
 * /orders/kitchen-queue/{restaurantId}:
 *   get:
 *     summary: Get kitchen queue for a specific restaurant (vendor staff only)
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200: { description: List of orders in kitchen queue }
 */
router.get(
  '/kitchen-queue/:restaurantId',
  restrictTo('VENDOR_STAFF', 'ADMIN'),
  orderController.getKitchenQueue
);


/**
 * @openapi
 * /orders/{id}/dispute:
 *   post:
 *     summary: Raise a dispute for an order (CUSTOMER/DELIVERER/ADMIN)
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             required: [reason]
 *             properties:
 *               reason: { type: string, enum: [WRONG_ITEMS, POOR_QUALITY, LATE_DELIVERY, OTHER] }
 *     responses:
 *       200: { description: Dispute raised successfully }  
 */
router.post(
  '/:id/dispute',
  restrictTo('CUSTOMER', 'DELIVERER', 'ADMIN'),
  validate(raiseDisputeSchema),
  orderController.raiseDispute
);

// Vendor/Deliverer status updates
/**
 * @openapi
 * /orders/{id}/status:
 *   patch:
 *     summary: Update order status (Vendor/Deliverer)
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             properties:
 *               state: { type: string, enum: [READY, PICKED_UP, DELIVERING, COMPLETED, CANCELLED, DELIVERED_NOT_RECEIVED] }
 *     responses:
 *       200: { description: Status updated }  
 */
router.patch('/:id/status', orderController.updateStatus);

// ==========================================
// CUSTOMER ORDER FLOW
// ==========================================

// Checkout: Converts cart to order (Requires CUSTOMER role)

/**
 * @openapi
 * /orders/checkout:
 *   post:
 *     summary: Convert a cart into a pending order
 *     tags: [Orders - Customer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [restaurantId, items, deliveryLat, deliveryLng]
 *             properties:
 *               restaurantId: { type: string, format: uuid }
 *               deliveryLat: { type: number, example: 9.0300 }
 *               deliveryLng: { type: number, example: 38.7400 }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     menuId: { type: string, format: uuid }
 *                     quantity: { type: integer, example: 1 }
 *     responses:
 *       201: { description: Order created }
 */
router.post(
  '/checkout', 
  restrictTo('CUSTOMER', 'DELIVERER', 'ADMIN'), 
  validate(checkoutSchema), 
  orderController.checkout
);

// Cancel Order: Allowed only before assignment

/**
 * @openapi
 * /orders/{id}/cancel:
 *   post:
 *     summary: Cancel an order (Customer/Vendor/Admin)
 *     tags: [Orders - Customer]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200: { description: Order cancelled successfully }  
 */
router.post(
  '/:id/cancel', 
  restrictTo('CUSTOMER', 'VENDOR_STAFF', 'ADMIN'), 
  validate(cancelOrderSchema), 
  orderController.cancelOrder
);

// ==========================================
// SHARED ORDER OVERSIGHT
// ==========================================

// Get Order Details: Custom IDOR checks applied in service


/**
 * @openapi
 * /orders/{id}:
 *   get:
 *     summary: Get detailed information about a specific order
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200: { description: Order details }  
 */
router.get(
  '/:id', 
  orderController.getDetails
);

/**
 * @openapi
 * /orders/disputes/{id}/resolve:
 *   patch:
 *     summary: Resolve a dispute (ADMIN only)
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action: { type: string, enum: [REFUND, PENALTY_APPLIED] }
 *               penaltyAmount: { type: number }
 *     responses:
 *       200: { description: Dispute resolved successfully }  
 */
router.patch(
  '/disputes/:id/resolve',
  restrictTo('ADMIN'),
  validate(resolveDisputeSchema),
  orderController.resolveDispute
);

/**
 * @openapi
 * /orders/{orderId}/retry-payout:
 *   post:
 *     summary: Retry a failed payout to a deliverer (ADMIN only)
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Payout retried successfully }  
 */
router.post(
  '/:orderId/retry-payout',
  restrictTo('ADMIN'),
  validate(retryPayoutSchema),
  orderController.retryPayout
);

export default router;