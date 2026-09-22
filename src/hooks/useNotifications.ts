import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  addNotification,
  markAsRead,
  markAllAsRead,
  removeNotification,
  clearAllNotifications,
  notificationService,
  Notification,
  NotificationType
} from '../services/notifications/notificationService';

/**
 * Хук для работы с уведомлениями
 * Предоставляет интерфейс для управления уведомлениями в приложении
 */
export const useNotifications = () => {
  const dispatch = useAppDispatch();
  const { notifications, isLoading, error } = useAppSelector(state => state.notifications);

  /**
   * Создание нового уведомления
   */
  const createNotification = useCallback(
    (notificationData: Omit<Notification, 'id' | 'time' | 'read'>) => {
      dispatch(addNotification(notificationData));

      // Также показываем браузерное уведомление, если это возможно
      notificationService.showBrowserNotification(
        notificationData.title,
        {
          body: notificationData.message,
          icon: getNotificationIcon(notificationData.type),
          tag: notificationData.type // Группируем уведомления по типу
        }
      );
    },
    [dispatch]
  );

  /**
   * Функция для получения иконки в зависимости от типа уведомления
   */
  const getNotificationIcon = (type: NotificationType): string => {
    switch (type) {
      case 'task':
        return '/icons/task-icon.png';
      case 'project':
        return '/icons/project-icon.png';
      case 'system':
      default:
        return '/icons/system-icon.png';
    }
  };

  /**
   * Отметка уведомления как прочитанного
   */
  const readNotification = useCallback(
    (notificationId: string) => {
      dispatch(markAsRead(notificationId));
    },
    [dispatch]
  );

  /**
   * Отметка всех уведомлений как прочитанных
   */
  const readAllNotifications = useCallback(
    () => {
      dispatch(markAllAsRead());
    },
    [dispatch]
  );

  /**
   * Удаление уведомления
   */
  const deleteNotification = useCallback(
    (notificationId: string) => {
      dispatch(removeNotification(notificationId));
    },
    [dispatch]
  );

  /**
   * Удаление всех уведомлений
   */
  const deleteAllNotifications = useCallback(
    () => {
      dispatch(clearAllNotifications());
    },
    [dispatch]
  );

  /**
   * Создание уведомления о новой задаче
   */
  const createTaskNotification = useCallback(
    (taskTitle: string, taskId: string) => {
      const notification = notificationService.createTaskNotification(taskTitle, taskId);
      createNotification(notification);
    },
    [createNotification]
  );

  /**
   * Создание уведомления о приближающемся дедлайне
   */
  const createDeadlineNotification = useCallback(
    (entityType: 'task' | 'project', title: string, id: string, daysLeft: number) => {
      const notification = notificationService.createDeadlineNotification(entityType, title, id, daysLeft);
      createNotification(notification);
    },
    [createNotification]
  );

  /**
   * Создание уведомления о завершении задачи или проекта
   */
  const createCompletionNotification = useCallback(
    (entityType: 'task' | 'project', title: string, id: string) => {
      const notification = notificationService.createCompletionNotification(entityType, title, id);
      createNotification(notification);
    },
    [createNotification]
  );

  /**
   * Создание системного уведомления
   */
  const createSystemNotification = useCallback(
    (title: string, message: string) => {
      const notification = notificationService.createSystemNotification(title, message);
      createNotification(notification);
    },
    [createNotification]
  );

  /**
   * Запрос разрешения на браузерные уведомления
   */
  const requestNotificationPermission = useCallback(
    async () => {
      return await notificationService.requestPermission();
    },
    []
  );

  /**
   * Проверка поддержки браузерных уведомлений
   */
  const isBrowserNotificationsSupported = useCallback(
    () => {
      return notificationService.isBrowserNotificationsSupported();
    },
    []
  );

  /**
   * Получение количества непрочитанных уведомлений
   */
  const getUnreadCount = useCallback(
    () => {
      return notifications.filter(notification => !notification.read).length;
    },
    [notifications]
  );

  return {
    notifications,
    isLoading,
    error,
    createNotification,
    readNotification,
    readAllNotifications,
    deleteNotification,
    deleteAllNotifications,
    createTaskNotification,
    createDeadlineNotification,
    createCompletionNotification,
    createSystemNotification,
    requestNotificationPermission,
    isBrowserNotificationsSupported,
    getUnreadCount
  };
};