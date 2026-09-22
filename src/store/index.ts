import { configureStore } from '@reduxjs/toolkit';
import { settingsPersistenceMiddleware } from '../features/settings/settingsPersistenceMiddleware';

// Импортируем редьюсеры
import authReducer from '../features/auth/authSlice';
import tasksReducer from '../features/tasks/tasksSlice';
import projectsReducer from '../features/projects/projectsSlice';
import settingsReducer from '../features/settings/settingsSlice';
import notificationsReducer from '../services/notifications/notificationService';

/**
 * Корневой стор приложения
 * Здесь регистрируются все reducer'ы для различных фич
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    tasks: tasksReducer,
    projects: projectsReducer,
    settings: settingsReducer,
    notifications: notificationsReducer, // Добавляем новый редьюсер
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(settingsPersistenceMiddleware),
  devTools: import.meta.env.DEV,
});

// Выводим типы из нашего хранилища
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
