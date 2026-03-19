import prisma from '../../infrastructure/database/prisma.client.js';

export class MenuService {
  async createCategory(data) {
    return await prisma.category.create({ data });
  }

  async createMenuItem(restaurantId, data) {
    // Ensure the category belongs to the restaurant before creating
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, restaurantId }
    });

    if (!category) throw new Error("Invalid category for this restaurant");

    return await prisma.menuItem.create({
      data: { ...data, restaurantId }
    });
  }
}