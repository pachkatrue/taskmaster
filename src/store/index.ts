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
  // Добавляем middleware, если потребуется
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(settingsPersistenceMiddleware),
  devTools: process.env.NODE_ENV !== 'production', // Включаем DevTools только в режиме разработки
});

// Выводим типы из нашего хранилища
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Создаем типизированные хуки для использования в компонентах
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;