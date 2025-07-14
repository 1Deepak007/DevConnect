// Protected routes only
notificationRoutes.get('/', authenticate, getNotifications);
// notificationRoutes.patch('/:notificationId/mark-read', authenticate, markAsRead);
// notificationRoutes.delete('/:notificationId', authenticate, deleteNotification);
// notificationRoutes.patch('/mark-all-read', authenticate, markAllAsRead);