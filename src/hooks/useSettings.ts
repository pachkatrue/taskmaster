import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  fetchSettingsStart,
  fetchSettingsSuccess,
  fetchSettingsError,
  updateSettings,
  setTheme,
  setNotifications,
  setAppSettings,
  resetSettings,
  ThemeSettings,
  NotificationSettings,
  AppSettings,
  SettingsState
} from '../features/settings/settingsSlice';
import { dbService } from '../services/storage/dbService';
import {db} from "../services/storage/db";

/**
 * Хук для работы с настройками
 * Предоставляет интерфейс для управления настройками приложения
 */
export const useSettings = () => {
  const dispatch = useAppDispatch();
  const { theme, notifications, app, isLoading, error } = useAppSelector(state => state.settings);

  // Загрузка настроек с учетом демо-режима
  const loadSettings = useCallback(async () => {
    dispatch(fetchSettingsStart());
    try {
      // Проверяем текущую сессию
      const session = await dbService.getCurrentSession();
      const isDemo = session?.provider === 'demo' || localStorage.getItem('demo_mode') === 'true';

      let settings;

      if (isDemo) {
        // В демо-режиме пробуем получить настройки из localStorage
        const demoSettings = localStorage.getItem('demo_settings');

        if (demoSettings) {
          // Если настройки есть в localStorage, используем их
          settings = JSON.parse(demoSettings);
        } else {
          // Иначе получаем демо-настройки из БД
          settings = await db.settings
          .filter(setting => setting.demoData === true)
          .first();
        }
      } else {
        // В обычном режиме получаем настройки текущего пользователя
        settings = await db.settings
        .filter(setting =>
          !setting.demoData &&
          (setting.userId === session?.userId || setting.id === '1')
        )
        .first();
      }

      if (settings) {
        dispatch(fetchSettingsSuccess({
          theme: settings.theme,
          notifications: settings.notifications,
          app: settings.app
        }));
        return settings;
      } else {
        // Если настройки не найдены, используем дефолтные
        dispatch(fetchSettingsSuccess({
          theme: {
            darkMode: true,
            reducedMotion: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            accentColor: '#3730a3',
          },
          notifications: {
            emailNotifications: true,
            pushNotifications: false,
            taskReminders: true,
            weeklyReports: true,
          },
          app: {
            language: 'ru',
            autoSave: true,
            dateFormat: 'DD.MM.YYYY',
            timeFormat: '24h',
          }
        }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при загрузке настроек';
      dispatch(fetchSettingsError(errorMessage));
      throw error;
    }
  }, [dispatch]);

  // Обновление всех настроек
  const saveSettings = useCallback(
    (settings: Partial<SettingsState>) => {
      return dispatch(updateSettings(settings));
    },
    [dispatch]
  );

  // Обновление настроек темы
  const updateTheme = useCallback(
    (themeSettings: Partial<ThemeSettings>) => {
      return dispatch(setTheme(themeSettings));
    },
    [dispatch]
  );

  // Обновление настроек уведомлений
  const updateNotifications = useCallback(
    (notificationSettings: Partial<NotificationSettings>) => {
      return dispatch(setNotifications(notificationSettings));
    },
    [dispatch]
  );

  // Обновление настроек приложения
  const updateAppSettings = useCallback(
    (appSettings: Partial<AppSettings>) => {
      return dispatch(setAppSettings(appSettings));
    },
    [dispatch]
  );

  // Сброс настроек
  const resetAllSettings = useCallback(
    () => {
      return dispatch(resetSettings());
    },
    [dispatch]
  );

  // Переключение темной темы
  const toggleDarkMode = useCallback(
    () => {
      return dispatch(setTheme({ darkMode: !theme.darkMode }));
    },
    [dispatch, theme.darkMode]
  );

  return {
    theme,
    notifications,
    app,
    isLoading,
    error,
    loadSettings,
    saveSettings,
    updateTheme,
    updateNotifications,
    updateAppSettings,
    resetAllSettings,
    toggleDarkMode
  };
};