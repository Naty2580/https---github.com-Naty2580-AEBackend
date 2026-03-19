import prisma from '../../infrastructure/database/prisma.client.js';

export class RestaurantRepository {
  async update(id, data) {
    return await prisma.restaurant.update({ where: { id }, data });
  }

  async findById(id) {
    return await prisma.restaurant.findUnique({
      where: { id },
      include: { menu: true, categories: true }
    });
  }
  
  async toggleOpenStatus(id, isOpen) {
    return await prisma.restaurant.update({ where: { id }, data: { isOpen } });
  }
}