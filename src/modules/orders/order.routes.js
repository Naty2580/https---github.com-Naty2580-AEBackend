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

router.get(
  '/', 
  validate(orderQuerySchema), 
  orderController.listOrders
);

router.patch(
  '/:id/state/vendor', 
  restrictTo('VENDOR_STAFF', 'ADMIN'), 
  validate(updateVendorStateSchema), 
  orderController.vendorUpdateState
);


router.patch(
  '/:id/state/deliverer', 
  restrictTo('DELIVERER', 'ADMIN'), 
  validate(updateDelivererStateSchema), 
  orderController.delivererUpdateState
);

router.post(
  '/:id/confirm-handshake', 
  restrictTo('CUSTOMER', 'DELIVERER', 'ADMIN'), // Deliverers/Admins as customers
  validate(completeOrderSchema), 
  orderController.customerConfirmOTP
);

// Deliverer accepting an order
router.post('/:id/accept', restrictTo('DELIVERER'), orderController.acceptOrder);
router.post(
  '/:id/drop',
  restrictTo('DELIVERER'),
  validate(dropOrderSchema),
  orderController.dropOrder
);

router.get(
  '/active-delivery',
  restrictTo('DELIVERER', 'ADMIN'),
  orderController.getActiveDelivery
);

router.get(
  '/kitchen-queue/:restaurantId',
  restrictTo('VENDOR_STAFF', 'ADMIN'),
  orderController.getKitchenQueue
);


router.post(
  '/:id/dispute',
  restrictTo('CUSTOMER', 'DELIVERER', 'ADMIN'),
  validate(raiseDisputeSchema),
  orderController.raiseDispute
);

// Vendor/Deliverer status updates
router.patch('/:id/status', orderController.updateStatus);

// ==========================================
// CUSTOMER ORDER FLOW
// ==========================================

// Checkout: Converts cart to order (Requires CUSTOMER role)
router.post(
  '/checkout', 
  restrictTo('CUSTOMER', 'DELIVERER', 'ADMIN'), // Remember: Deliverers & Admins can order food too
  validate(checkoutSchema), 
  orderController.checkout
);

// Cancel Order: Allowed only before assignment
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
router.get(
  '/:id', 
  orderController.getDetails
);


router.patch(
  '/disputes/:id/resolve',
  restrictTo('ADMIN'),
  validate(resolveDisputeSchema),
  orderController.resolveDispute
);

router.post(
  '/:orderId/retry-payout',
  restrictTo('ADMIN'),
  validate(retryPayoutSchema),
  orderController.retryPayout
);

export default router;