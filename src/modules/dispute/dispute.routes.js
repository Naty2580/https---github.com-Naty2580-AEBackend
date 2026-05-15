import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import * as disputeController from './dispute.controller.js';

const router = Router();

router.use(protect);

/**
 * @openapi
 * /disputes:
 *   get:
 *     summary: List all disputes
 *     tags: [Disputes]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [OPEN, UNDER_REVIEW, RESOLVED, CLOSED] }
 *         description: Filter disputes by status
 *     responses:
 *       200:
 *         description: Successfully retrieved disputes list.
 */
router.get('/', restrictTo('ADMIN'), disputeController.listDisputes);

/**
 * @openapi
 * /disputes/{id}/resolve:
 *   patch:
 *     summary: Resolve a dispute
 *     tags: [Disputes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: UUID of the dispute
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status, resolution]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [RESOLVED, CLOSED]
 *               resolution:
 *                 type: string
 *     responses:
 *       200:
 *         description: Dispute resolved successfully.
 */
router.patch('/:id/resolve', restrictTo('ADMIN'), disputeController.resolveDispute);

export default router;
