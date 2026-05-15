import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import * as ledgerController from './ledger.controller.js';

// ... existing mountings

const router = Router(); 

router.use(protect);

/**
 * @openapi
 * /ledger/me:
 *   get:
 *     summary: Get my ledger entries (Earnings & Payouts)
 *     tags: [Ledger]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Successfully retrieved personal ledger.
 */
router.get('/me', restrictTo('DELIVERER', 'ADMIN'), ledgerController.getMyLedger);

/**
 * @openapi
 * /ledger/platform:
 *   get:
 *     summary: Get platform ledger (Revenue, Escrow, and Payouts)
 *     tags: [Ledger]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Successfully retrieved platform ledger summary and transactions.
 */
router.get('/platform', restrictTo('ADMIN'), ledgerController.getPlatformLedger);

export default router;