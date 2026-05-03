import { notificationService } from './notification.service.js';

export const getMyNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.getUserNotifications(req.user.id, req.query.page, req.query.limit);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    await notificationService.markRead(req.user.id, req.params.id);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    await notificationService.markAllRead(req.user.id);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};