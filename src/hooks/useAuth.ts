import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  loginUser,
  registerUser,
  logoutUser,
  loginWithFacebook,
  clearError,
  tryAutoLogin,
  User
} from '../features/auth/authSlice';
import { dbService } from '../services/storage/dbService';

/**
 * Хук для работы с авторизацией
 * Предоставляет интерфейс для входа, регистрации и выхода из системы,
 * включая методы авторизации через социальные сети и гостевой доступ
 */
export const useAuth = () => {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, isLoading, error } = useAppSelector(state => state.auth);

  // Функция проверки наличия активной сессии
  const checkSession = useCallback(
    () => {
      return dispatch(tryAutoLogin());
    },
    [dispatch]
  );

  // Функция входа через email/пароль с сохранением сессии
  const login = useCallback(
    async (email: string, password: string) => {
      const result = await dispatch(loginUser({ email, password })).unwrap();

      const isDemo = email === 'demo@taskmaster.pro';
      await dbService.createAuthSession(
        result,
        `token_${Date.now()}`,
        isDemo ? 'guest' : 'email'
      );
      if (isDemo) {
        localStorage.setItem('guest_mode', 'true');
      }
      return result;
    },
    [dispatch]
  );

  // Функция регистрации с сохранением сессии
  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      const result = await dispatch(registerUser({ fullName, email, password })).unwrap();

      // Если успешная регистрация, создаем сессию
      await dbService.createAuthSession(
        result,
        `token_${Date.now()}`,
        'email'
      );

      return result;
    },
    [dispatch]
  );

  // Функция входа через Google
  const loginWithGoogleAuth = useCallback(
    () => {
      // Вместо вызова асинхронного экшена используем прямую инициацию OAuth потока
      // через сервис, который выполнит редирект на страницу Google
      import('../services/auth/googleAuthService').then(module => {
        const { googleAuthService } = module;
        googleAuthService.signIn();
      });
      // Не возвращаем диспатч, так как происходит редирект
    },
    []
  );

  // Функция входа через Facebook
  const loginWithFacebookAuth = useCallback(
    async () => {
      const result = await dispatch(loginWithFacebook()).unwrap();

      // Если успешный вход, создаем сессию
      await dbService.createAuthSession(
        result,
        `facebook_token_${Date.now()}`,
        'facebook'
      );

      return result;
    },
    [dispatch]
  );

  // Функция обработки успешной авторизации через OAuth
  const loginSuccess = useCallback(
    async (userData: User, token: string) => {
      try {
        // Проверяем, был ли пользователь в гостевом режиме
        const isGuest = localStorage.getItem('guest_mode') === 'true';

        if (isGuest && user) {
          // Мигрируем данные гостевого пользователя
          await dbService.migrateGuestData(user.id, userData.id);
          localStorage.removeItem('guest_mode');
        }

        // Создаем сессию в IndexedDB
        const provider = token.includes('google') ? 'google' : 'facebook';
        await dbService.createAuthSession(userData, token, provider);

        // Обновляем состояние в Redux
        dispatch({
          type: 'auth/loginSuccess',
          payload: userData
        });
      } catch (error) {
        console.error('Ошибка при обработке успешной авторизации:', error);
      }
    },
    [dispatch, user]
  );

  // Функция выхода с учетом индексированной БД
  const logout = useCallback(
    async () => {
      return dispatch(logoutUser());
    },
    [dispatch]
  );

  // Функция очистки ошибок
  const clearAuthError = useCallback(
    () => {
      dispatch(clearError());
    },
    [dispatch]
  );

  // Возвращаем расширенный набор функций
  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    loginWithGoogleAuth,
    loginWithFacebookAuth,
    loginSuccess,
    clearAuthError,
    checkSession
  };
};