import { CategoryRepository } from './categories.repository.js';
import { CategoryService } from './categories.service.js';

const repository = new CategoryRepository();
export const categoryService = new CategoryService(repository);

export const create = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const category = await categoryService.createCategory(req.user, restaurantId, req.body);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const { restaurantId, categoryId } = req.params;
    const category = await categoryService.updateCategory(req.user, restaurantId, categoryId, req.body);
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { restaurantId, categoryId } = req.params;
    await categoryService.deleteCategory(req.user, restaurantId, categoryId);
    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const categories = await categoryService.getCategories(restaurantId);
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

export const reorder = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    await categoryService.reorderCategories(req.user, restaurantId, req.body.categories);
    res.status(200).json({ success: true, message: 'Categories reordered successfully' });
  } catch (error) {
    next(error);
  }
};