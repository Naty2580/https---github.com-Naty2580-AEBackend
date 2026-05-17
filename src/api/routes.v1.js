import express from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/users/users.routes.js';
import restaurantRoutes from '../modules/restaurants/restaurant.routes.js';
import menuRoutes from '../modules/menus/menu.routes.js';
import * as menuController from '../modules/menus/menu.controller.js';
import { validate } from '../api/middlewares/validate.middleware.js';
import { queryMenuItemsSchema } from '../modules/menus/menu.dto.js';
import { protect } from '../api/middlewares/auth.middleware.js';
import orderRoutes from '../modules/orders/order.routes.js';
import dispatchRoutes from '../modules/dispatch/dispatch.routes.js';
import paymentRoutes from '../modules/payments/payment.routes.js';
import ledgerRoutes from '../modules/ledger/ledger.routes.js';
import notificationRoutes from '../modules/notification/notification.routes.js';
import fraudRoutes from '../modules/fraud/fraud.routes.js';
import disputeRoutes from '../modules/dispute/dispute.routes.js';
import configRoutes from '../modules/config/config.routes.js';
import analyticsRoutes from '../modules/analytics/analytics.routes.js';



const router = express.Router();

// Health check endpoint for load balancers (AWS ALB, Nginx, Kubernetes)
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ASTU Eats API is running smoothly.',
    timestamp: new Date().toISOString()
  });
});

router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/restaurants', restaurantRoutes);
router.use('/restaurants/:restaurantId', menuRoutes); 

router.use('/orders', orderRoutes);
router.use('/dispatch', dispatchRoutes);
router.use('/payments', paymentRoutes);
router.use('/ledger', ledgerRoutes);
router.use('/fraud', fraudRoutes);
router.use('/disputes', disputeRoutes);
router.use('/config', configRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/notifications', notificationRoutes); 

// Global menu search endpoint (no restaurantId in path)
router.get(
  '/discovery/search', 
  protect, 
  validate(queryMenuItemsSchema), 
  menuController.globalSearch
);

export default router;