import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import { validate } from '../../api/middlewares/validate.middleware.js';
import { resolveAnomalySchema } from './fraud.dto.js';
import * as fraudController from './fraud.controller.js';

const router = Router();

// Only Admins can access the fraud monitoring dashboard
router.use(protect, restrictTo('ADMIN'));

router.get('/anomalies', fraudController.listAnomalies);
router.patch('/anomalies/:id/resolve', validate(resolveAnomalySchema), fraudController.resolveAnomaly);

export default router;