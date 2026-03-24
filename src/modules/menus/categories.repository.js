import prisma from '../../infrastructure/database/prisma.client.js';

export class CategoryRepository {
  async create(restaurantId, data) {
    return await prisma.category.create({
      data: {
        restaurantId,
        name: data.name,
        sortOrder: data.sortOrder
      }
    });
  }

  async findById(categoryId, restaurantId) {
    return await prisma.category.findFirst({
      where: { id: categoryId, restaurantId },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });
  }

  async update(categoryId, data) {
    return await prisma.category.update({
      where: { id: categoryId },
      data
    });
  }

   async countActiveCategories(restaurantId) {
    return await prisma.category.count({
      where: { restaurantId, isArchived: false }
    });
  }

    async checkOrderHistory(categoryId) {
    // Check if any product inside this category has ever been ordered
    const count = await prisma.orderItem.count({
      where: { product: { categoryId } }
    });
    return count > 0;
  }

 async hardDelete(categoryId) {
    return await prisma.category.delete({ where: { id: categoryId } });
  }

  async softDelete(categoryId) {
    // Cascading soft-delete: Archive the category AND all its products
    return await prisma.$transaction([
      prisma.category.update({
        where: { id: categoryId },
        data: { isArchived: true }
      }),
      prisma.menuItem.updateMany({
        where: { categoryId },
        data: { isArchived: true, isAvailable: false }
      })
    ]);
  }

  async findAllByRestaurant(restaurantId) {
    return await prisma.category.findMany({
      where: { restaurantId, isArchived: false },
      orderBy: { sortOrder: 'asc' }
    });
  }

  async bulkUpdateSortOrder(restaurantId, categoriesData) {
    // Perform bulk update in a transaction to ensure integrity
    const updates = categoriesData.map(cat => 
      prisma.category.update({
        where: { id: cat.id, restaurantId }, // Ensure category belongs to restaurant
        data: { sortOrder: cat.sortOrder }
      })
    );
    return await prisma.$transaction(updates);
  }
}