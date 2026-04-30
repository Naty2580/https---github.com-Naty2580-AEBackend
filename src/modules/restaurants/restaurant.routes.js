import { Router } from 'express';
import { protect } from '../../api/middlewares/auth.middleware.js';
import { restrictTo } from '../../api/middlewares/rbac.middleware.js';
import { validate } from '../../api/middlewares/validate.middleware.js';
import {
  createRestaurantSchema, updateRestaurantSchema,
  queryRestaurantSchema, toggleStatusSchema, restaurantIdParamSchema
} from './restaurant.dto.js';
import * as controller from './restaurant.controller.js';

const router = Router();

router.use(protect);

/**
 * @openapi
 * /restaurants:
 *   get:
 *     summary: List all restaurants (with filters)
 *     tags: [Restaurants]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by restaurant name
 *       - in: query
 *         name: isOpen
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma separated list of tags (e.g., Fast Food, Local)
 *     responses:
 *       200:
 *         description: Successfully retrieved list of restaurants
 */
router.get('/', validate(queryRestaurantSchema), controller.list);
/**
 * @openapi
 * /restaurants/{id}:
 *   get:
 *     summary: Get details of a specific restaurant
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique Restaurant ID
 *     responses:
 *       200:
 *         description: Successfully retrieved restaurant details
 *       404:
 *         description: Restaurant not found
 */
router.get('/:id', validate(restaurantIdParamSchema), controller.getDetails);

/**
 * @openapi
 * /restaurants:
 *   post:
 *     summary: Register a new restaurant (Admin only)
 *     tags: [Restaurants]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - location
 *               - phone
 *               - lat
 *               - lng
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Pizza Hut"
 *               location:
 *                 type: string
 *                 example: "Bole, Addis Ababa"
 *               phone:
 *                 type: string
 *                 example: "0911223344"
 *               lat:
 *                 type: number
 *                 example: 9.0300
 *               lng:
 *                 type: number
 *                 example: 38.7400
 *               minOrderValue:
 *                 type: number
 *                 default: 0
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Pizza", "Fast Food"]
 *               openingTime:
 *                 type: string
 *                 example: "08:00"
 *               closingTime:
 *                 type: string
 *                 example: "22:00"
 *     responses:
 *       201:
 *         description: Restaurant successfully created
 */
router.post('/',
  restrictTo('ADMIN'), // Only Admins can register new restaurants
  validate(createRestaurantSchema),
  controller.create
);

/**
 * @openapi
 * /restaurants/{id}:
 *   delete:
 *     summary: Decommission a restaurant (Admin only)
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Restaurant successfully decommissioned
 */
router.delete(
  '/:id',
  restrictTo('ADMIN'),
  validate(restaurantIdParamSchema),
  controller.decommission
);

/**
 * @openapi
 * /restaurants/{id}/status:
 *   patch:
 *     summary: Toggle Open/Closed status
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isOpen
 *             properties:
 *               isOpen:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch(
  '/:id/status',
  restrictTo('VENDOR_STAFF', 'ADMIN'),
  validate(toggleStatusSchema),
  controller.updateStatus
);

/**
 * @openapi
 * /restaurants/{id}:
 *   patch:
 *     summary: Update general restaurant details
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               location:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *                 example: "https://example.com/image.jpg"
 *     responses:
 *       200:
 *         description: Restaurant details updated
 */
router.patch('/:id', restrictTo('ADMIN', 'VENDOR_STAFF'), validate(updateRestaurantSchema), controller.update)


export default router;