import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import * as ledgerController from './ledger.controller.js';

// ... existing mountings

const router = Router(); 

router.use(protect);


router.get('/me', restrictTo('DELIVERER', 'ADMIN'), ledgerController.getMyLedger);
router.get('/platform', restrictTo('ADMIN'), ledgerController.getPlatformLedger);


export default router;