import { NotFoundError, ConflictError, BusinessLogicError } from '../../core/errors/domain.errors.js';
import { RESTAURANT_ERRORS } from '../../core/errors/error.codes.js';
import { RestaurantRepository } from '../restaurants/restaurant.repository.js';

export class MenuService {
  constructor(menuRepository) {
    this.menuRepository = menuRepository;
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
  
  async createMenuItem(user, restaurantId, data) {
    await this._verifyAccess(user, restaurantId);

    // Business Rule: The category must belong to this specific restaurant
    const validCategory = await this.menuRepository.verifyCategoryBelongsToRestaurant(data.categoryId, restaurantId);
    if (!validCategory) {
      throw new BusinessLogicError('Category does not belong to this restaurant.');
    }

    const itemCount = await this.menuRepository.countActiveItemsInCategory(data.categoryId);
    if (itemCount >= 100) {
      throw new BusinessLogicError('Maximum limit of 100 items per category reached.');
    }

    // Name Collision Check
    const nameExists = await this.menuRepository.checkNameExistsInRestaurant(restaurantId, data.name);
    if (nameExists) {
      throw new ConflictError('An item with this name already exists in your restaurant.');
    }


    return await this.menuRepository.create(restaurantId, data);
  }

  async updateMenuItem(user, restaurantId, itemId, data) {
    await this._verifyAccess(user, restaurantId);

    const item = await this.menuRepository.findById(itemId, restaurantId);
    if (!item || item.isArchived) throw new NotFoundError(RESTAURANT_ERRORS.ITEM_NOT_FOUND);

    if (data.categoryId && data.categoryId !== item.categoryId) {
      const validCategory = await this.menuRepository.verifyCategoryBelongsToRestaurant(data.categoryId, restaurantId);
      if (!validCategory) {
        throw new BusinessLogicError('Target category does not belong to this restaurant.');
      }
        const itemCount = await this.menuRepository.countActiveItemsInCategory(data.categoryId);
      if (itemCount >= 100) throw new BusinessLogicError('Target category is full (max 100 items).');
    }

    if (data.name && data.name !== item.name) {
      const nameExists = await this.menuRepository.checkNameExistsInRestaurant(restaurantId, data.name, itemId);
      if (nameExists) throw new ConflictError('An item with this name already exists in your restaurant.');
    }


    return await this.menuRepository.update(itemId, data);
  }

  async toggleAvailability(user, restaurantId, itemId, isAvailable, reason) {
    await this.restaurantService._verifyAccess(user, restaurantId);

    const item = await this.menuRepository.findById(itemId, restaurantId);
    if (!item) throw new NotFoundError(RESTAURANT_ERRORS.ITEM_NOT_FOUND);

    return await this.menuRepository.updateAvailability(itemId, isAvailable, reason);
  }

  async deleteMenuItem(user, restaurantId, itemId) {
    await this.restaurantService._verifyAccess(user, restaurantId);

    const item = await this.menuRepository.findById(itemId, restaurantId);
    if (!item) throw new NotFoundError(RESTAURANT_ERRORS.ITEM_NOT_FOUND);

     const hasHistory = await this.menuRepository.checkOrderHistory(itemId);

    if (hasHistory) {
      // Soft Delete: Hide from public menu to preserve financial records
      await this.menuRepository.softDelete(itemId);
    } else {
      // Hard Delete: Safe to remove completely
      await this.menuRepository.hardDelete(itemId);
    }
  }

   async listMenuItems(user, restaurantId, query) {

    // If they want archived/hidden items, verify they are staff
    const isOwner = user.role === 'ADMIN' || 
                   (restaurantId && await this.restaurantRepository.checkVendorAccess(user.id, restaurantId));

    if (query.includeArchived === 'true' && !isOwner) {
      throw new ForbiddenError('Only restaurant staff can view archived items.');
    }

    if (query.minPrice && query.maxPrice && query.minPrice > query.maxPrice) {
      throw new BusinessLogicError('Minimum price cannot be greater than maximum price.');
    }

    const skip = (query.page - 1) * query.limit;
    const result= await this.menuRepository.findAllItems({
      restaurantId,
      skip,
      take: query.limit,
      ...query
    });

    result.items = result.items.map(item => {
      const scheduleOpen = isCurrentlyOpen(
        item.restaurant.openingTime, 
        item.restaurant.closingTime
      );
      return {
        ...item,
        effectiveAvailability: item.isAvailable && item.restaurant.isOpen && scheduleOpen
      };
    });

    return result;

   }

   async bulkToggleAvailability(user, restaurantId, itemIds, isAvailable) {
    await this.restaurantService._verifyAccess(user, restaurantId);

    // UpdateMany handles the verification inherently because the repository 
    // restricts the update to `where: { id: { in: itemIds }, restaurantId }`.
    // Any IDs that don't belong to the restaurant are silently ignored, preventing IDOR.
    const result = await this.menuRepository.bulkUpdateAvailability(restaurantId, itemIds, isAvailable);
    
    return { updatedCount: result.count };
  }
}