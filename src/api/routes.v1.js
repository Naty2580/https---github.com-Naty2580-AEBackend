import express from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/users/users.routes.js';


const router = express.Router();

// Health check endpoint for load balancers (AWS ALB, Nginx, Kubernetes)
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ASTU Eats API is running smoothly.',
    timestamp: new Date().toISOString()
  });
});
router.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ASTU Eats API is running smoothly.',
    timestamp: new Date().toISOString()
  });
});



router.use('/users', userRoutes);
router.use('/auth', authRoutes);

// router.use('/api/users', userRoutes);
// router.use('/api/auth', authRoutes);
// router.use('/api/restaurants', restaurantRoutes);

export default router;