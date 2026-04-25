import express from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/users/users.routes.js';
import restaurantRoutes from '../modules/restaurants/restaurant.routes.js';
import menuRoutes from '../modules/menus/menu.routes.js';
import paymentsRoutes from '../modules/payments/payment.routes.js';
import * as menuController from '../modules/menus/menu.controller.js';
import { validate } from '../api/middlewares/validate.middleware.js';
import { queryMenuItemsSchema } from '../modules/menus/menu.dto.js';
import { protect } from '../api/middlewares/auth.middleware.js';


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
router.use('/payments', paymentsRoutes);

// Global menu search endpoint (no restaurantId in path)
router.get(
  '/discovery/search', 
  protect, 
  validate(queryMenuItemsSchema), 
  menuController.globalSearch
);

export default router;