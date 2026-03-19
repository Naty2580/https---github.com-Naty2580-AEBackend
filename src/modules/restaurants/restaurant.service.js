// import prisma from '../../config/prisma.js';

// // --- Restaurant Logic ---
// export const getAllRestaurants = async () => {
//   return await prisma.restaurant.findMany({
//     where: { isActive: true }
//   });
// };

// export const createRestaurant = async (data) => {
//   return await prisma.restaurant.create({ data });
// };

// // --- Menu Logic ---
// export const getRestaurantMenu = async (restaurantId) => {
//   // Professional Query: Fetch categories AND their products in one go
//   return await prisma.category.findMany({
//     where: { restaurantId },
//     orderBy: { sortOrder: 'asc' },
//     include: {
//       products: {
//         where: { isAvailable: true }
//       }
//     }
//   });
// };

// export const addCategory = async (restaurantId, name, sortOrder) => {
//   return await prisma.category.create({
//     data: { restaurantId, name, sortOrder }
//   });
// };

// export const addProduct = async (restaurantId, productData) => {
//   return await prisma.product.create({
//     data: { ...productData, restaurantId }
//   });
// };


import prisma from '../../infrastructure/database/prisma.client.js';

export class RestaurantService {
  async create(data) {
    return await prisma.restaurant.create({
      data: {
        name: data.name,
        location: data.location,
        lat: data.lat,
        lng: data.lng,
        mode: data.mode
      }
    });
  }

  async getAll() {
    return await prisma.restaurant.findMany({ where: { isOpen: true } });
  }
}