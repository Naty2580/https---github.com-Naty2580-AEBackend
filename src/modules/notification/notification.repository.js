import prisma from '../../infrastructure/database/prisma.client.js';

export class NotificationRepository {
  async create(userId, title, message, type) {
    return await prisma.notification.create({
      data: { userId, title, message, type }
    });
  }

  async findByUserId(userId, skip, take) {
    return await prisma.$transaction([
      prisma.notification.count({ where: { userId, isRead: false } }), // Unread count
      prisma.notification.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      })
    ]);
  }

  async markAsRead(notificationId, userId) {
    return await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true }
    });
  }

  async markAllAsRead(userId) {
    return await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
  }
}