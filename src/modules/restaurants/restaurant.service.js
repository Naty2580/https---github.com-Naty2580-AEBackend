import { NotFoundError, ForbiddenError, BusinessLogicError } from '../../core/errors/domain.errors.js';
import { RESTAURANT_ERRORS } from '../../core/errors/error.codes.js';
import { calculateDistance } from '../../core/utils/pricing.utils.js';
import { isCurrentlyOpen } from '../../core/utils/time.utils.js';
import { CAMPUS_CONFIG } from '../../config/fee.config.js';
 
export class RestaurantService {
  constructor(restaurantRepository) {
    this.restaurantRepository = restaurantRepository;
  }

  async _verifyAccess(user, restaurantId) {
    if (user.role === 'ADMIN') return true;
    
    if (user.role === 'VENDOR_STAFF') {
      const access = await this.restaurantRepository.checkVendorAccess(user.id, restaurantId);
      if (!access) {
        throw new ForbiddenError(RESTAURANT_ERRORS.UNAUTHORIZED_ACCESS);
      }
      return access;
    }
    
    throw new ForbiddenError(RESTAURANT_ERRORS.UNAUTHORIZED_ACCESS);
  }

  _validateCampusBounds(lat, lng) {
    const distance = calculateDistance(
      CAMPUS_CONFIG.CENTER_LAT, 
      CAMPUS_CONFIG.CENTER_LNG, 
      lat, 
      lng
    );
    if (distance > CAMPUS_CONFIG.MAX_RADIUS_METERS) {
      throw new BusinessLogicError(
        `Location is outside ASTU campus boundaries (${Math.round(distance)}m away).`
      );
    }
  }

   async createRestaurant(adminId, data) {
    
    this._validateCampusBounds(data.lat, data.lng);
    return await this.restaurantRepository.create(data);
  
  }

  async updateRestaurant(user, restaurantId, data) {
    const restaurant = await this.restaurantRepository.findById(restaurantId);
    if (!restaurant) throw new NotFoundError(RESTAURANT_ERRORS.NOT_FOUND);

    await this._verifyAccess(user, restaurantId);

    if (data.lat !== undefined || data.lng !== undefined) {
      const newLat = data.lat ?? restaurant.lat;
      const newLng = data.lng ?? restaurant.lng;
      this._validateCampusBounds(newLat, newLng);
    }

     if (data.mode && user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can change the operating mode.');
    }

    // Business Logic: VENDOR_STAFF cannot modify ADMIN_MANAGED restaurants
    if (user.role === 'VENDOR_STAFF' && restaurant.mode === 'ADMIN_MANAGED') {
      throw new BusinessLogicError(RESTAURANT_ERRORS.INVALID_MODE_OPERATION);
    }

if (data.mode === 'ADMIN_MANAGED' && restaurant.mode === 'VENDOR_MANAGED') {
      return await this.restaurantRepository.updateToAdminManaged(restaurantId, data);
    }

    return await this.restaurantRepository.update(restaurantId, data);
  }

  async syncRestaurantRating(restaurantId) {
    return await this.restaurantRepository.updateAggregateRating(restaurantId);
  }
   async getRestaurantDetails(id) {
    const restaurant = await this.restaurantRepository.findDetailsWithMenu(id);
    if (!restaurant || !restaurant.isActive) throw new NotFoundError(RESTAURANT_ERRORS.NOT_FOUND);
    const scheduleOpen = isCurrentlyOpen(restaurant.openingTime, restaurant.closingTime);
    restaurant.effectiveIsOpen = restaurant.isOpen && scheduleOpen;

    return restaurant;
  }

  async listRestaurants(query) {
    let bounds = null;

    

    // 1. Prepare Bounding Box for DB Pruning
    if (query.userLat !== undefined && query.userLng !== undefined) {
      bounds = {
        minLat: query.userLat - 0.02,
        maxLat: query.userLat + 0.02,
        minLng: query.userLng - 0.02,
        maxLng: query.userLng + 0.02
      };
    }

    // 2. Fetch Pruned Data from Repository
    const rawRestaurants = await this.restaurantRepository.findAllActive({
      isOpen: query.isOpen, 
      search: query.search,
      tags: query.tags,
      minRating: query.minRating,
      bounds
    });

    // 3. SINGLE PASS TRANSFORMATION (Optimization: O(N))
    // We calculate distance and schedule status in one loop
    let restaurants = rawRestaurants.map(rest => {
      const scheduleOpen = isCurrentlyOpen(rest.openingTime, rest.closingTime);
      const distance = (query.userLat && query.userLng)
        ? Math.round(calculateDistance(query.userLat, query.userLng, rest.lat, rest.lng))
        : null;

      return {
        ...rest,
        distanceMeters: distance,
        effectiveIsOpen: rest.isOpen && scheduleOpen
      };
    });

    // 4. Apply Schedule-Aware Filtering
    // If user requested "Open Now", we filter by the computed effective status
    if (query.isOpen === 'true') {
      restaurants = restaurants.filter(rest => rest.effectiveIsOpen);
    }

    // 5. Advanced Sorting Logic (Refined for UX)
    restaurants.sort((a, b) => {
      if (query.sortBy === 'distance' && a.distanceMeters !== null) {
        return a.distanceMeters - b.distanceMeters;
      }
      if (query.sortBy === 'rating') {
        return Number(b.avgRating) - Number(a.avgRating);
      }
      // Default: Name
      return a.name.localeCompare(b.name);
    });

    // 6. Pagination
    const total = restaurants.length;
    const skip = (query.page - 1) * query.limit;
    const paginatedResults = restaurants.slice(skip, skip + query.limit);

    return { 
      total, 
      restaurants: paginatedResults 
    };
  }

  // async listActiveRestaurants(query) {
  //   const skip = (query.page - 1) * query.limit;
  //   return await this.restaurantRepository.findAllActive({ skip, take: query.limit, isOpen: query.isOpen, search: query.search });
  // }

   async decommissionRestaurant(adminId, restaurantId) {
    // Only Admin can decommission a restaurant
    const restaurant = await this.restaurantRepository.findById(restaurantId);
    if (!restaurant) throw new NotFoundError(RESTAURANT_ERRORS.NOT_FOUND);

    await this.restaurantRepository.softDelete(restaurantId);
  }

}