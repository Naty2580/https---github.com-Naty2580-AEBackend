import { NotificationRepository } from './notification.repository.js';
import { socketManager } from '../../infrastructure/websockets/socket.manager.js';

export class NotificationService {
  constructor() {
    this.repository = new NotificationRepository();
  }

  /**
   * Internal Method: Used by OrderService to trigger persistent alerts
   */
  async sendNotification(userId, title, message, type) {
    const notification = await this.repository.create(userId, title, message, type);
    
    // Also push it via WebSockets if they are currently online
    socketManager.emitToUser(userId, 'NEW_NOTIFICATION', notification);
    
    return notification;
  }

  async getUserNotifications(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [unreadCount, notifications] = await this.repository.findByUserId(userId, skip, limit);
    return { unreadCount, notifications };
  }

  async markRead(userId, notificationId) {
    await this.repository.markAsRead(notificationId, userId);
  }

  async markAllRead(userId) {
    await this.repository.markAllAsRead(userId);
  }
}

export const notificationService = new NotificationService();