import prisma from '../../infrastructure/database/prisma.client.js';

export class MenuRepository {
  async create(restaurantId, data) {
    return await prisma.menuItem.create({
      data: {
        restaurantId,
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        price: data.price,
        imageUrl: data.imageUrl,
        isAvailable: data.isAvailable,
        prepTimeMins: data.prepTimeMins
      }
    });
  }

  async findById(itemId, restaurantId) {
    return await prisma.menuItem.findFirst({
      where: { id: itemId, restaurantId }
    });
  }


  async update(itemId, data) {
    return await prisma.menuItem.update({
      where: { id: itemId },
      data
    });
  }

  async updateAvailability(itemId, isAvailable) {
    return await prisma.menuItem.update({
      where: { id: itemId },
      data: { isAvailable },
      select: { id: true, name: true, isAvailable: true }
    });
  }

  async delete(itemId) {
    return await prisma.menuItem.delete({
      where: { id: itemId }
    });
  }

  async countActiveItemsInCategory(categoryId) {
    return await prisma.menuItem.count({
      where: { categoryId, isArchived: false }
    });
  }


async checkNameExistsInCategory(categoryId, name, excludeItemId = null) {
    const item = await prisma.menuItem.findFirst({
      where: {
        categoryId,
        isArchived: false,
        name: { equals: name, mode: 'insensitive' },
        id: excludeItemId ? { not: excludeItemId } : undefined
      }
    });
    return !!item;
  }


  async verifyCategoryBelongsToRestaurant(categoryId, restaurantId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, restaurantId }
    });
    return !!category;
  }

  async checkOrderHistory(itemId) {
    const count = await prisma.orderItem.count({
      where: { menuId: itemId }
    });
    return count > 0;
  }

  async softDelete(itemId) {
    return await prisma.menuItem.update({
      where: { id: itemId },
      data: { isArchived: true, isAvailable: false } // Hide it and mark unavailable
    });
  }

  async hardDelete(itemId) {
    return await prisma.menuItem.delete({
      where: { id: itemId }
    });
  }

  async findAllItems({ restaurantId, skip, take, search, categoryId, includeArchived, isAvailable, isFasting, minPrice, maxPrice, sortBy }) {
    const where = { restaurantId };

    if (includeArchived === 'false') {
      where.isArchived = false;
    }

    if (isFasting !== undefined) {
      where.isFasting = isFasting === 'true';
    }

    if (isAvailable !== undefined) {
      where.isAvailable = isAvailable === 'true';
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {
        ...(minPrice !== undefined && { gte: minPrice }),
        ...(maxPrice !== undefined && { lte: maxPrice }),
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    let orderBy = { name: 'asc' };
    if (sortBy === 'price_asc') orderBy = { price: 'asc' };
    if (sortBy === 'price_desc') orderBy = { price: 'desc' };

    const [total, items] = await prisma.$transaction([
      prisma.menuItem.count({ where }),
      prisma.menuItem.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          category: { select: { name: true } },
          restaurant: {
            select: {
              id: true, name: true, isOpen: true,
              openingTime: true, closingTime: true
            }
          }
        }
      })
    ]);

    const mappedItems = items.map(item => ({
      ...item,
      // Effective Availability: Item is available AND Restaurant is open
      effectiveAvailability: item.isAvailable && item.restaurant.isOpen
    }));

    return { total, items: mappedItems };
  }

  async updateAvailability(itemId, isAvailable, reason = null) {
    return await prisma.menuItem.update({
      where: { id: itemId },
      data: {
        isAvailable,
        availabilityReason: isAvailable ? null : reason // Clear reason if becoming available
      },
      select: { id: true, name: true, isAvailable: true, availabilityReason: true }
    });
  }

  async bulkUpdateAvailability(restaurantId, itemIds, isAvailable) {
    return await prisma.menuItem.updateMany({
      where: {
        id: { in: itemIds },
        restaurantId // Strict boundary: ensures they only update items belonging to this restaurant
      },
      data: { isAvailable }
    });
  }

}