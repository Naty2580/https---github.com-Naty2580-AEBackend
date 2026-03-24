
import { RestaurantRepository } from './restaurant.repository.js';
import { RestaurantService } from './restaurant.service.js';

const repository = new RestaurantRepository();
export const restaurantService = new RestaurantService(repository);

export const create = async (req, res, next) => {
  try {
    const restaurant = await restaurantService.createRestaurant(req.user.id, req.body);
    res.status(201).json({ success: true, data: restaurant });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const restaurant = await restaurantService.updateRestaurant(req.user, id, req.body);
    res.status(200).json({ success: true, data: restaurant });
  } catch (error) {
    next(error);
  }
};

export const getDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const restaurant = await restaurantService.getRestaurantDetails(id);
    res.status(200).json({ success: true, data: restaurant });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const result = await restaurantService.listRestaurants(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};


export const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isOpen } = req.body;
    const restaurant = await restaurantService.updateRestaurant(req.user, id, { isOpen });
    res.json({ success: true, data: restaurant });
  } catch (error) {
    next(error);
  }
};

export const decommission = async (req, res, next) => {
  try {
    const { id } = req.params;
    await restaurantService.decommissionRestaurant(req.user.id, id);
    res.status(200).json({ success: true, message: 'Restaurant successfully decommissioned.' });
  } catch (error) {
    next(error);
  }
};