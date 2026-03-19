// import * as restaurantService from './restaurants.service.js';

// export const getRestaurants = async (req, res, next) => {
//   try {
//     const data = await restaurantService.getAllRestaurants();
//     res.status(200).json({ success: true, data });
//   } catch (error) { next(error); }
// };

// export const createRestaurant = async (req, res, next) => {
//   try {
//     const data = await restaurantService.createRestaurant(req.body);
//     res.status(201).json({ success: true, data });
//   } catch (error) { next(error); }
// };

// export const getMenu = async (req, res, next) => {
//   try {
//     const data = await restaurantService.getRestaurantMenu(req.params.id);
//     res.status(200).json({ success: true, data });
//   } catch (error) { next(error); }
// };

// export const createCategory = async (req, res, next) => {
//   try {
//     const data = await restaurantService.addCategory(req.params.restaurantId, req.body.name, req.body.sortOrder);
//     res.status(201).json({ success: true, data });
//   } catch (error) { next(error); }
// };

// export const createProduct = async (req, res, next) => {
//   try {
//     const data = await restaurantService.addProduct(req.params.restaurantId, req.body);
//     res.status(201).json({ success: true, data });
//   } catch (error) { next(error); }
// };

import { RestaurantService } from './restaurant.service.js';

const restaurantService = new RestaurantService();

export const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isOpen } = req.body;
    const restaurant = await restaurantService.toggleOpenStatus(id, isOpen);
    res.json({ success: true, data: restaurant });
  } catch (error) {
    next(error);
  }
};