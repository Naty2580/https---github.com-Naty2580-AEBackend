import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import * as controller from './notification.controller.js';

const router = Router();
router.use(protect);

router.get('/', controller.getMyNotifications);
router.patch('/read-all', controller.markAllAsRead);
router.patch('/:id/read', controller.markAsRead);

export default router;