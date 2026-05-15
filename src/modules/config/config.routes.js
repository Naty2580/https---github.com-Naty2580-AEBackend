import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import * as configController from './config.controller.js';

const router = Router();

router.use(protect);

/**
 * @openapi
 * /config:
 *   get:
 *     summary: List all system configurations
 *     tags: [System Config]
 *     responses:
 *       200:
 *         description: Successfully retrieved all config entries.
 */
router.get('/', restrictTo('ADMIN'), configController.listAll);

/**
 * @openapi
 * /config/{key}:
 *   get:
 *     summary: Get a single config by key
 *     tags: [System Config]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *         description: The configuration key (e.g., PLATFORM_FEE_PERCENT)
 *     responses:
 *       200:
 *         description: Successfully retrieved config.
 *       404:
 *         description: Config key not found.
 */
router.get('/:key', restrictTo('ADMIN'), configController.getOne);

/**
 * @openapi
 * /config:
 *   post:
 *     summary: Create a new system configuration
 *     tags: [System Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, value]
 *             properties:
 *               key:
 *                 type: string
 *                 example: MAX_DELIVERIES_PER_HOUR
 *               value:
 *                 type: string
 *                 example: "10"
 *     responses:
 *       201:
 *         description: Config created successfully.
 *       409:
 *         description: Config key already exists.
 */
router.post('/', restrictTo('ADMIN'), configController.create);

/**
 * @openapi
 * /config/{key}:
 *   patch:
 *     summary: Update an existing system configuration value
 *     tags: [System Config]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [value]
 *             properties:
 *               value:
 *                 type: string
 *                 example: "0.10"
 *     responses:
 *       200:
 *         description: Config updated successfully.
 *       404:
 *         description: Config key not found.
 */
router.patch('/:key', restrictTo('ADMIN'), configController.update);

/**
 * @openapi
 * /config/{key}:
 *   delete:
 *     summary: Delete a system configuration
 *     tags: [System Config]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Config deleted successfully.
 *       404:
 *         description: Config key not found.
 */
router.delete('/:key', restrictTo('ADMIN'), configController.remove);

export default router;
