import prisma from '../../infrastructure/database/prisma.client.js';

export class OrderRepository {
  async createFullOrder(orderData, items) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: { ...orderData, items: { create: items } }
      });
      return order;
    });
  }

  async transitionOrderStatus(id, currentStatus, newStatus, changedById) {
    try {
      return await prisma.$transaction([
        prisma.order.update({
          // The Magic: We mandate the currentStatus in the WHERE clause.
          // If a concurrent request already changed it, this throws a RecordNotFound error.
          where: {
            id,
            status: currentStatus
          },
          data: { status: newStatus }
        }),
        prisma.orderStatusHistory.create({
          data: { orderId: id, newStatus, changedById }
        })
      ]);
    } catch (error) {
      // Prisma throws P2025 if the WHERE clause fails to find a match
      if (error.code === 'P2025') {
        throw new Error('STATE_CONFLICT');
      }
      throw error;
    }
  }

    async transitionOrderStatusWithETA(id, currentStatus, newStatus, changedById, estimatedPrepTimeMins) {
    try {
      const data = { status: newStatus };
      
      // If vendor provides an ETA, calculate the exact timestamp
      if (estimatedPrepTimeMins) {
        const readyAt = new Date();
        readyAt.setMinutes(readyAt.getMinutes() + estimatedPrepTimeMins);
        data.estimatedReadyAt = readyAt;
      }

      return await prisma.$transaction([
        prisma.order.update({
          where: { id, status: currentStatus },
          data
        }),
        prisma.orderStatusHistory.create({
          data: { orderId: id, newStatus, changedById }
        })
      ]);
    } catch (error) {
      if (error.code === 'P2025') throw new Error('STATE_CONFLICT');
      throw error;
    }
  }

  async findById(id) {
    return await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          select: {
            id: true, quantity: true, unitPrice: true,
            product: { select: { name: true, imageUrl: true } }
          }
        },
        restaurant: { select: { name: true, location: true, mode: true, phone: true, lat: true, lng: true } },
        customer: {
          select: {
            defaultLocation: true, rating: true,
            user: { select: { fullName: true, phoneNumber: true } }
          }
        },
        deliverer: {
          select: {
            rating: true,
            user: { select: { fullName: true, phoneNumber: true, avatarUrl: true } }
          }
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, oldStatus: true, newStatus: true, createdAt: true }
        }
      }
    });
  }

  async createOrderWithItems(orderData, itemsData) {
    return await prisma.$transaction(async (tx) => {
      // 1. Create the Order
      const order = await tx.order.create({
        data: {
          shortId: orderData.shortId,
          customerId: orderData.customerId,
          restaurantId: orderData.restaurantId,
          foodPrice: orderData.foodPrice,
          deliveryFee: orderData.deliveryFee,
          serviceFee: orderData.serviceFee,
          transactionFee: 0.00, // Determined later by payment gateway
          tip: orderData.tip,
          totalAmount: orderData.totalAmount,
          payoutAmount: orderData.payoutAmount,
          status: 'AWAITING_ACCEPT',
          paymentStatus: 'AWAITING_PAYMENT',
          otpCode: orderData.otpCode,

          // 2. Nested write for Order Items
          items: {
            create: itemsData.map(item => ({
              menuId: item.menuId,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            }))
          },

          // 3. Nested write for Status History initialization
          statusHistory: {
            createMany: {
              data: [
                { newStatus: 'CREATED', changedById: orderData.customerId },
                { newStatus: 'AWAITING_ACCEPT', changedById: orderData.customerId }
              ]
            }
          }
        },
        include: {
          items: true,
          restaurant: { select: { name: true, location: true, mode: true, phone: true } }
        }
      });
      return order;
    });
  }


  async atomicAssignOrder(orderId, delivererId) {
    return await prisma.$transaction(async (tx) => {
      // 1. SELECT ... FOR UPDATE (This blocks other concurrent transactions for this row)
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, assignedDelivererId: true },
        // The magic: FOR UPDATE
        _lock: 'update'
      });

      // 2. Strict Business Logic Verification
      if (!order) {
        throw new Error("Order does not exist.");
      }

      if (order.status !== 'AWAITING_ACCEPT' || order.assignedDelivererId !== null) {
        throw new Error("This order has already been claimed by another deliverer.");
      }

      // 3. Perform the update while holding the lock
      return await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'ASSIGNED',
          assignedDelivererId: delivererId
        }
      });
    });
  }

  async fetchActiveMenuItems(restaurantId, menuIds) {
    return await prisma.menuItem.findMany({
      where: {
        restaurantId,
        id: { in: menuIds },
        isAvailable: true,
        isArchived: false
      },
      select: { id: true, price: true, name: true, isFasting: true }
    });
  }

  async updateStatus(id, newStatus, changedById) {
    return await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: { status: newStatus }
      }),
      prisma.orderStatusHistory.create({
        data: { orderId: id, newStatus, changedById }
      })
    ]);
  }

  async findAllOrders({ skip, take, status, roleAs, userId, restaurantId }) {
    const where = {};
    if (status) where.status = status;

    // Apply strict access boundaries based on the requested perspective
    if (roleAs === 'CUSTOMER') {
      where.customerId = userId;
    } else if (roleAs === 'DELIVERER') {
      where.assignedDelivererId = userId;
    } else if (roleAs === 'VENDOR') {
      if (!restaurantId) throw new Error("restaurantId is required for Vendor views");
      where.restaurantId = restaurantId;
    }
    // ADMIN sees all, no boundary applied

    const [total, orders] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          shortId: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          restaurant: { select: { name: true } },
          customer: { select: { user: { select: { fullName: true } } } },
          // Count items instead of fetching full payload
          _count: { select: { items: true } }
        }
      })
    ]);

    return { total, orders };
  }

  async markCustomerReceived(orderId, customerId) {
    return await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: { status: 'RECEIVED' } // State machine will auto-bump to COMPLETED if Deliverer is done
      }),
      prisma.orderStatusHistory.create({
        data: { orderId, newStatus: 'RECEIVED', changedById: customerId }
      })
    ]);
  }

  async markCustomerReceivedOCC(orderId, currentStatus, customerId) {
    try {
      return await prisma.$transaction([
        prisma.order.update({
          where: { id: orderId, status: currentStatus },
          data: { status: 'RECEIVED' }
        }),
        prisma.orderStatusHistory.create({
          data: { orderId, newStatus: 'RECEIVED', changedById: customerId }
        })
      ]);
    } catch (error) {
      if (error.code === 'P2025') throw new Error('STATE_CONFLICT');
      throw error;
    }
  }

  async dropDelivererAssignment(orderId, currentStatus, delivererId, reason) {
    try {
      return await prisma.$transaction([
        prisma.order.update({
          where: { id: orderId, status: currentStatus },
          data: {
            status: 'AWAITING_ACCEPT',
            assignedDelivererId: null
          }
        }),
        prisma.orderStatusHistory.create({
          data: { orderId, newStatus: 'AWAITING_ACCEPT', changedById: delivererId }
        }),
        // Log the drop as a DECLINED action to calculate penalty metrics later
        prisma.dispatchLog.create({
          data: {
            orderId,
            delivererId,
            action: 'DECLINED'
          }
        })
      ]);
    } catch (error) {
      if (error.code === 'P2025') throw new Error('STATE_CONFLICT');
      throw error;
    }
  }

  /**
   * REFINED: Hard-shifts an order to DISPUTED to freeze escrow funds.
   */
  async markDisputed(orderId, currentStatus, raisedById, reason) {
    try {
      return await prisma.$transaction([
        prisma.order.update({
          where: { id: orderId, status: currentStatus },
          data: { status: 'DISPUTED' }
        }),
        prisma.orderStatusHistory.create({
          data: { orderId, newStatus: 'DISPUTED', changedById: raisedById }
        }),
        prisma.dispute.create({
          data: {
            orderId,
            raisedById,
            reason,
            status: 'OPEN'
          }
        })
      ]);
    } catch (error) {
      if (error.code === 'P2025') throw new Error('STATE_CONFLICT');
      throw error;
    }
  }

  async cancelOrderOCC(orderId, currentStatus, actorId, reason) {
    try {
      return await prisma.$transaction([
        prisma.order.update({
          where: { id: orderId, status: currentStatus },
          data: { status: 'CANCELLED' }
        }),
        prisma.orderStatusHistory.create({
          data: {
            orderId,
            newStatus: 'CANCELLED',
            changedById: actorId,
            // You can optionally add a 'reason' column to orderStatusHistory in schema later
            // For now, it's just recorded in the audit logs or handled by the caller
          }
        })
      ]);
    } catch (error) {
      if (error.code === 'P2025') throw new Error('STATE_CONFLICT');
      throw error;
    }
  }

  async finalizeOrderAndTriggerPayout(orderId, expectedCurrentStatus, actorId, payoutService) {
    try {
      return await prisma.$transaction(async (tx) => {
        const [order] = await tx.$queryRaw`
          SELECT id, status, "payoutAmount", "assignedDelivererId" 
          FROM "Order" 
          WHERE id = ${orderId}::uuid 
          FOR UPDATE;
        `;

        if (!order) throw new Error('NOT_FOUND');
        if (order.status !== expectedCurrentStatus) throw new Error('STATE_CONFLICT');

        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: { status: 'COMPLETED' }
        });

        await tx.orderStatusHistory.create({
          data: { orderId, newStatus: 'COMPLETED', changedById: actorId }
        });

        // REFINED: Delegate to the robust Payout Engine
        await payoutService.executeDelivererPayout(updatedOrder, tx);

        return updatedOrder;
      });
    } catch (error) {
      if (error.message === 'STATE_CONFLICT') throw new Error('STATE_CONFLICT');
      throw error;
    }
  }

  async findActiveDelivery(delivererId) {
    const activeStates = [
      'ASSIGNED', 'AWAITING_PAYMENT', 'PAYMENT_RECEIVED',
      'VENDOR_BEING_PREPARED', 'VENDOR_READY_FOR_PICKUP',
      'PICKED_UP', 'EN_ROUTE', 'ARRIVED', 'RECEIVED'
    ];

    return await prisma.order.findFirst({
      where: {
        assignedDelivererId: delivererId,
        status: { in: activeStates }
      },
      include: {
        restaurant: { select: { name: true, location: true, phone: true, lat: true, lng: true } },
        customer: {
          select: {
            defaultLocation: true,
            user: { select: { fullName: true, phoneNumber: true } }
          }
        },
items: { select: { quantity: true, unitPrice: true, product: { select: { name: true } } } }      }
    });
  }

  /**
   * NEW: Kitchen Queue for Vendors
   * Returns un-paginated, active orders sorted by creation time (oldest first)
   */
  async getKitchenQueue(restaurantId) {
    const kitchenStates = ['PAYMENT_RECEIVED', 'VENDOR_BEING_PREPARED'];

    return await prisma.order.findMany({
      where: {
        restaurantId,
        status: { in: kitchenStates }
      },
      orderBy: { createdAt: 'asc' }, // Oldest orders at the top of the screen
      include: {
        items: { select: { quantity: true, product: { select: { name: true } } } },
        deliverer: { select: { user: { select: { fullName: true } } } }
      }
    });
  }
  
  async executeCryptographicHandshake(orderId, expectedStatus, delivererId, payoutService) {
    try {
      return await prisma.$transaction(async (tx) => {
        const [order] = await tx.$queryRaw`
          SELECT id, status, "payoutAmount", "assignedDelivererId" 
          FROM "Order" 
          WHERE id = ${orderId}::uuid 
          FOR UPDATE;
        `;

        if (!order) throw new Error('NOT_FOUND');
        if (order.status !== expectedStatus) throw new Error('STATE_CONFLICT');

        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: { status: 'COMPLETED' }
        });

        // Record both logical steps for the audit trail
        await tx.orderStatusHistory.createMany({
          data: [
            { orderId, newStatus: 'DELIVERED', changedById: delivererId },
            { orderId, newStatus: 'RECEIVED', changedById: delivererId },
            { orderId, newStatus: 'COMPLETED', changedById: delivererId }
          ]
        });

        await payoutService.executeDelivererPayout(updatedOrder, tx);

        return updatedOrder;
      });
    } catch (error) {
      if (error.message === 'STATE_CONFLICT') throw new Error('STATE_CONFLICT');
      throw error;
    }
  }

   async markUnfulfillable(orderId, delivererId, reasonEnum, details) {
    try {
      return await prisma.$transaction([
        prisma.order.update({
          where: { id: orderId },
          data: { status: 'CANCELLED' } // Cancel the order completely
        }),
        prisma.orderStatusHistory.create({
          data: { orderId, newStatus: 'CANCELLED', changedById: delivererId }
        }),
        // Log the operational failure for platform analytics
        prisma.dispatchLog.create({
          data: {
            orderId, delivererId, 
            action: 'DECLINED', // Penalize slightly or track for operational review
          }
        })
      ]);
    } catch (error) {
      throw error;
    }
  }

  async createReviewAndUpdateRatings(orderId, customerId, restaurantId, delivererId, data) {
    return await prisma.$transaction(async (tx) => {
      // 1. Create the Review
      const review = await tx.review.create({
        data: {
          orderId,
          rating: data.restaurantRating, // Storing restaurant rating in core review
          comment: data.comment
        }
      });

      // 2. Aggregate Restaurant Rating
      const restStats = await tx.review.aggregate({
        where: { order: { restaurantId } },
        _avg: { rating: true },
        _count: { id: true }
      });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { avgRating: restStats._avg.rating || 5.0, totalReviews: restStats._count.id }
      });

      // 3. Aggregate Deliverer Rating (If applicable)
      if (delivererId && data.delivererRating) {
        // We log a separate metric for deliverers (or you can expand the Review model later)
        // For now, we manually adjust a moving average for simplicity, or query past orders
        const delivererStats = await tx.order.aggregate({
          where: { assignedDelivererId: delivererId, status: 'COMPLETED' },
          _count: { id: true }
        });
        
        const currentProfile = await tx.delivererProfile.findUnique({ where: { userId: delivererId } });
        const currentRating = Number(currentProfile.rating);
        const totalDeliveries = delivererStats._count.id || 1;
        
        // Simple moving average
        const newRating = ((currentRating * (totalDeliveries - 1)) + data.delivererRating) / totalDeliveries;
        
        await tx.delivererProfile.update({
          where: { userId: delivererId },
          data: { rating: newRating.toFixed(2) }
        });
      }

      return review;
    });
  }
  
}