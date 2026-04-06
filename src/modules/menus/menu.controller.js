import { MenuRepository } from './menu.repository.js';
import { MenuService } from './menu.service.js';

const repository = new MenuRepository();
export const menuService = new MenuService(repository);

export const create = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const item = await menuService.createMenuItem(req.user, restaurantId, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const { restaurantId, itemId } = req.params;
    const item = await menuService.updateMenuItem(req.user, restaurantId, itemId, req.body);
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

export const toggleAvailability = async (req, res, next) => {
  try {
    const { restaurantId, itemId } = req.params;
    const { isAvailable, reason } = req.body;
    const item = await menuService.toggleAvailability(req.user, restaurantId, itemId, isAvailable, reason);
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

export const bulkToggleAvailability = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const { itemIds, isAvailable } = req.body;
    console.log("Bulk toggle request received for items:", itemIds, "to availability:", isAvailable);
    const result = await menuService.bulkToggleAvailability(req.user, restaurantId, itemIds, isAvailable);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { restaurantId, itemId } = req.params;
    await menuService.deleteMenuItem(req.user, restaurantId, itemId);
    res.status(200).json({ success: true, message: 'Menu item deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const listItems = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const result = await menuService.listMenuItems(req.user, restaurantId, req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const globalSearch = async (req, res, next) => {
  try {
    // Note: restaurantId is undefined for this call
    const result = await menuService.listMenuItems(req.user, undefined, req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};