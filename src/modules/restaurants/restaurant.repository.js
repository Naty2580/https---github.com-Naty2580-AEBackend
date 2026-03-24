import prisma from '../../infrastructure/database/prisma.client.js';

export class RestaurantRepository {

  async create(data) {
    return await prisma.restaurant.create({
      data: {
        name: data.name,
        mode: data.mode,
        location: data.location,
        phone: data.phone, 
        lat: data.lat,
        lng: data.lng,
        imageUrl: data.imageUrl,
        openingTime: data.openingTime,
        closingTime: data.closingTime
      },
      select: {
        id: true,
        name: true,
        mode: true,
        location: true,
        phone: true, // ADDED
        isOpen: true
      }
    });
  }

  async update(id, data) {
    return await prisma.restaurant.update({
      where: { id },
      data,
      select: { id: true, name: true, location: true, phone: true, isOpen: true, mode: true, openingTime: true, closingTime: true }
    });
  }


  async findById(id) {
    return await prisma.restaurant.findUnique({
      where: { id },
      include: { menu: true, categories: true }
    });
  }

  async findDetailsWithMenu(id) {
    return await prisma.restaurant.findUnique({
      where: { id },
      include: {
        categories: {
          where: { isArchived: false },
          orderBy: { sortOrder: 'asc' },
          include: {
            products: {
              where: { isAvailable: true, isArchived: false },
              orderBy: { name: 'asc' },
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                imageUrl: true,
                prepTimeMins: true,
                isAvailable: true,
                // We do NOT return isArchived to the public
              }
            }
          }
        }
      }
    });
  }

  async findAll({ skip, take, isOpen, search }) {
    const where = {};
    if (isOpen !== undefined) {
      where.isOpen = isOpen === 'true';
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [total, restaurants] = await prisma.$transaction([
      prisma.restaurant.count({ where }),
      prisma.restaurant.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          location: true,
          isOpen: true,
          imageUrl: true,
          lat: true,
          lng: true,
          mode: true
        }
      })
    ]);

    return { total, restaurants };
  }


  async toggleOpenStatus(id, isOpen) {
    return await prisma.restaurant.update({ where: { id }, data: { isOpen } });
  }

  async updateToAdminManaged(id, data) {
    return await prisma.$transaction(async (tx) => {
      // 1. Find all Vendor Staff currently assigned to this restaurant
      const vendorProfiles = await tx.vendorProfile.findMany({
        where: { restaurantId: id },
        select: { userId: true }
      });
      const userIds = vendorProfiles.map(vp => vp.userId);

      // 2. Demote those users back to CUSTOMER
      if (userIds.length > 0) {
        await tx.user.updateMany({
          where: { id: { in: userIds }, role: 'VENDOR_STAFF' },
          data: { role: 'CUSTOMER' }
        });
      }

      // 3. Delete the vendor profiles
      await tx.vendorProfile.deleteMany({
        where: { restaurantId: id }
      });

      // 4. Update the restaurant
      return await tx.restaurant.update({
        where: { id },
        data,
        select: { id: true, name: true, mode: true }
      });
    });
  }

  async checkVendorAccess(userId, restaurantId) {
    return await prisma.vendorProfile.findFirst({
      where: { userId, restaurantId }
    });
  }

  async findAllActive({ isOpen, search, tags, minRating, bounds }) {
    // We only ever return isActive: true to the public/vendors
    const where = { isActive: true };

    if (isOpen !== undefined) {
      where.isOpen = isOpen === 'true';
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    if (minRating) {
      where.avgRating = { gte: minRating };
    }
    if (bounds) {
      where.lat = { gte: bounds.minLat, lte: bounds.maxLat };
      where.lng = { gte: bounds.minLng, lte: bounds.maxLng };
    }

    return await prisma.restaurant.findMany({
      where,
      select: {
        id: true,
        name: true,
        location: true,
        isOpen: true,
        imageUrl: true,
        lat: true,
        lng: true,
        mode: true,
        avgRating: true,
        tags: true,
        openingTime: true,
        closingTime: true
      }
    });
  }

  async softDelete(id) {
    return await prisma.$transaction([
      prisma.restaurant.update({
        where: { id },
        data: { isActive: false, isOpen: false } // Deactivate and force closed
      }),
      prisma.menuItem.updateMany({
        where: { restaurantId: id },
        data: { isAvailable: false } // Force all items offline to prevent cart ghosts
      })
    ]);
  }

  async updateAggregateRating(restaurantId) {
    const stats = await prisma.review.aggregate({
      where: { order: { restaurantId } },
      _avg: { rating: true },
      _count: { id: true }
    });

    return await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        avgRating: stats._avg.rating || 5.0,
        totalReviews: stats._count.id
      }
    });
  }

}