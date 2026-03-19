import prisma from '../../infrastructure/database/prisma.client.js';

export class UserRepository {
  async create(data) {
    return await prisma.user.create({
      data,
      select: { id: true, astuEmail: true, fullName: true, role: true }
    });
  }

  async findByEmail(astuEmail) {
    return await prisma.user.findUnique({
      where: { astuEmail }
    });
  }

  async findByTelegramId(telegramId) {
    return await prisma.user.findUnique({
      where: { telegramId }
    });
  }

  async findById(id) {
    return await prisma.user.findUnique({
      where: { id },
      include: { customerProfile: true, delivererProfile: true }
    });
  }

  async findByPhoneNumber(phoneNumber) {
    return await prisma.user.findUnique({ where: { phoneNumber } });
  }

  async findAll() {
    return await prisma.user.findMany({
      include: { customerProfile: true, delivererProfile: true }
    });
  }

  async update(id, data) {
    return await prisma.user.update({ where: { id }, data,select: { id: true, fullName: true, phoneNumber: true, avatarUrl: true,role: true, activeMode: true } });
  }

   async findByIdWithProfiles(id) {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        astuEmail: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        status: true,
        customerProfile: true,
        delivererProfile: true,
        vendorProfile: { include: { restaurant: true } }
      }
    });
  }

  async hasActiveOrders(userId) {
    const activeStatuses = [
      'ASSIGNED', 'AWAITING_PAYMENT', 'PAYMENT_RECEIVED', 
      'VENDOR_BEING_PREPARED', 'VENDOR_FINISHED', 
      'VENDOR_READY_FOR_PICKUP', 'PICKED_UP', 'EN_ROUTE', 'ARRIVED'
    ];

    const orderCount = await prisma.order.count({
      where: {
        OR: [
          { customer: { userId }, status: { in: activeStatuses } },
          { deliverer: { userId }, status: { in: activeStatuses } }
        ]
      }
    });

    return orderCount > 0;
  }

  async findByIdWithStats(id) {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        customerProfile: {
          select: { rating: true, _count: { select: { orders: true } } }
        },
        delivererProfile: {
          select: { 
            rating: true, 
            verificationStatus: true, 
            isAvailable: true,
            _count: { select: { deliveries: true } } 
          }
        },
        vendorProfile: { include: { restaurant: true } }
      }
    });
  }

  async createDelivererProfile(userId, data) {
    return await prisma.delivererProfile.create({
      data: {
        userId,
        idCardUrl: data.idCardUrl,
        payoutProvider: data.payoutProvider,
        payoutAccount: data.payoutAccount,
        verificationStatus: 'PENDING'
      }
    });
  }

   async updateDelivererStatus(userId, status) {

    const isApproved = status === 'APPROVED';

    const newRole = isApproved ? 'DELIVERER' : 'CUSTOMER';

    return await prisma.$transaction([
      prisma.delivererProfile.update({
        where: { userId },
        data: {
         verificationStatus: status === 'REVOKED' ? 'REJECTED' : status,
          isVerified: isApproved,
          isAvailable: false // Default to offline
        }
      }),
      prisma.user.update({
        where: { id: userId },
        data: { role: newRole, activeMode: 'CUSTOMER' }
      })
    ]);
  }

   async updatePassword(id, hashedPassword) {
    return await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });
  }
  
   async updatePayoutInfo(userId, data) {
    return await prisma.delivererProfile.update({
      where: { userId },
      data: {
        payoutProvider: data.payoutProvider,
        payoutAccount: data.payoutAccount
      }
    });
   }

   async delete(id) {
    return await prisma.user.update({ where: { id }, data: { isActive: false } });
  }

  async updateActiveMode(userId, mode) {
   return await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { activeMode: mode },
        select: { id: true, activeMode: true, role: true }
      });

      // Business Rule: If switching to CUSTOMER, force deliverer availability to false
      if (mode === 'CUSTOMER') {
        await tx.delivererProfile.updateMany({
          where: { userId },
          data: { isAvailable: false }
        });
      }

      return user;
    });
  }

  async updateAvailability(userId, isAvailable) {
    return await prisma.delivererProfile.update({
      where: { userId },
      data: { isAvailable },
      select: { isAvailable: true }
    });
  }
   async createAuditLog(data) {
    return await prisma.userAuditLog.create({ data });
  }

   // ==========================================
  // VENDOR STAFF MANAGEMENT
  // ==========================================
  
  async checkRestaurantExists(restaurantId) {
    return await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  }

  async assignVendorStaff(userId, restaurantId, isOwner) {
    return await prisma.$transaction([
      prisma.vendorProfile.upsert({
        where: { userId },
        update: { restaurantId, isOwner },
        create: { userId, restaurantId, isOwner }
      }),
      prisma.user.update({
        where: { id: userId },
        data: { role: 'VENDOR_STAFF' }
      })
    ]);
  }

  // ==========================================
  // ADMIN USER MANAGEMENT
  // ==========================================

  async findAllUsers({ skip, take, role, status, search }) {
    const where = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { astuEmail: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          astuEmail: true,
          fullName: true,
          role: true,
          status: true,
          createdAt: true
        }
      })
    ]);

    return { total, users };
  }

  async updateUserStatus(userId, status) {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { status }
      });

      // If BANNED, revoke all refresh tokens immediately
      if (status === 'BANNED') {
        await tx.refreshToken.updateMany({
          where: { userId, isRevoked: false },
          data: { isRevoked: true }
        });
      }

      return user;
    });
  }

  async deactivate(userId) {
    return await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { status: 'DEACTIVATED', isActive: false }
      }),
      prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true }
      })
    ]);
  }
  async logAction(data) {
    return await prisma.userAuditLog.create({ data });
  
  }

  async canDeactivate(userId) {
    const activeOrders = await this.hasActiveOrders(userId);
    
    // Check for open disputes
    const openDisputes = await prisma.dispute.count({
      where: {
        OR: [{ raisedById: userId }, { order: { assignedDelivererId: userId } }],
        status: { in: ['OPEN', 'UNDER_REVIEW'] }
      }
    });

    return !activeOrders && openDisputes === 0;
  }


}
