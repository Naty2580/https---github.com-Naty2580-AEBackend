import { NotFoundError, ForbiddenError, BusinessLogicError, ConflictError } from '../../core/errors/domain.errors.js';
import { RESTAURANT_ERRORS } from '../../core/errors/error.codes.js';
import { RestaurantRepository } from '../restaurants/restaurant.repository.js';

export class CategoryService {
  constructor(categoryRepository) {
    this.categoryRepository = categoryRepository;
    this.restaurantRepository = new RestaurantRepository();
  }

   async _verifyAccess(user, restaurantId) {
    if (user.role === 'ADMIN') return true;
    
    if (user.role === 'VENDOR_STAFF') {
      const access = await this.restaurantRepository.checkVendorAccess(user.id, restaurantId);
      if (!access) throw new ForbiddenError(RESTAURANT_ERRORS.UNAUTHORIZED_ACCESS);
      return access;
    }
    
    throw new ForbiddenError(RESTAURANT_ERRORS.UNAUTHORIZED_ACCESS);
  }


   async _ensureUniqueName(restaurantId, name, excludeCategoryId = null) {
    const categories = await this.categoryRepository.findAllByRestaurant(restaurantId);
    const exists = categories.some(c => 
      c.name.toLowerCase() === name.toLowerCase() && c.id !== excludeCategoryId
    );
    if (exists) {
      throw new ConflictError('A category with this name already exists in this restaurant.');
    }
  }

  
  async createCategory(user, restaurantId, data) {
    await this._verifyAccess(user, restaurantId);

    const count = await this.categoryRepository.countActiveCategories(restaurantId);
    if (count >= 20) {
      throw new BusinessLogicError('Maximum limit of 20 categories reached.');
    }

        await this._ensureUniqueName(restaurantId, data.name);


    return await this.categoryRepository.create(restaurantId, data);
  }

  async updateCategory(user, restaurantId, categoryId, data) {
    await this._verifyAccess(user, restaurantId);

    const category = await this.categoryRepository.findById(categoryId, restaurantId);
    if (!category || category.isArchived) throw new NotFoundError(RESTAURANT_ERRORS.NOT_FOUND);

    if (data.name && data.name !== category.name) {
      await this._ensureUniqueName(restaurantId, data.name, category.id);
    }
    return await this.categoryRepository.update(categoryId, data);
  }

  async deleteCategory(user, restaurantId, categoryId) {
    await this._verifyAccess(user, restaurantId);

    const category = await this.categoryRepository.findById(categoryId, restaurantId);
    if (!category || category.isArchived) throw new NotFoundError(RESTAURANT_ERRORS.NOT_FOUND);

    // Business Logic: Prevent deletion if products exist to avoid cascading destruction of order history
     const hasHistory = await this.categoryRepository.checkOrderHistory(categoryId);

    if (hasHistory) {
      await this.categoryRepository.softDelete(categoryId);
    } else {
      await this.categoryRepository.hardDelete(categoryId);
    }
  }


  async getCategories(restaurantId) {
    // Public read access, no verifyAccess required
    return await this.categoryRepository.findAllByRestaurant(restaurantId);
  }

  async reorderCategories(user, restaurantId, categories) {
    await this.restaurantService._verifyAccess(user, restaurantId);

    // Defensive Check: Ensure all IDs provided actually exist in the DB for this restaurant
    const existingCategories = await this.categoryRepository.findAllByRestaurant(restaurantId);
    const existingIds = existingCategories.map(c => c.id);

    for (const cat of categories) {
      if (!existingIds.includes(cat.id)) {
        throw new BusinessLogicError(`Category ${cat.id} does not exist or does not belong to this restaurant.`);
      }
    }

    await this.categoryRepository.bulkUpdateSortOrder(restaurantId, categories);
  }
}