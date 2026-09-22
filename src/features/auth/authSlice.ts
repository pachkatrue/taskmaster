import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { apiService } from '../../services/api/apiService';
import { dbService } from '../../services/storage/dbService';
import { db } from '../../services/storage/db';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  bio?: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const defaultAuthState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

const getPersistedAuth = (): Pick<AuthState, 'user' | 'isAuthenticated'> => {
  try {
    const persisted = localStorage.getItem('auth');

    if (!persisted) {
      return {
        user: null,
        isAuthenticated: false,
      };
    }

    const parsed = JSON.parse(persisted) as Partial<AuthState>;

    return {
      user: parsed.user ?? null,
      isAuthenticated: parsed.isAuthenticated === true,
    };
  } catch {
    localStorage.removeItem('auth');

    return {
      user: null,
      isAuthenticated: false,
    };
  }
};

const initialState: AuthState = {
  ...defaultAuthState,
  ...getPersistedAuth(),
};

const persistAuth = (user: User): void => {
  localStorage.setItem(
    'auth',
    JSON.stringify({
      user,
      isAuthenticated: true,
    }),
  );
};

export const tryAutoLogin = createAsyncThunk(
  'auth/tryAutoLogin',
  async (_, { rejectWithValue }) => {
    try {
      const user = await dbService.tryAutoLogin();

      if (user) {
        return user;
      }

      return rejectWithValue('Нет активной сессии');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Ошибка автоматического входа';

      return rejectWithValue(errorMessage);
    }
  },
);

export const loginAsGuest = createAsyncThunk(
  'auth/loginAsGuest',
  async (_, { rejectWithValue }) => {
    try {
      const guestSession = await dbService.createGuestSession();
      const guestUser = await db.users.get(guestSession.userId);

      if (guestUser) {
        return guestUser;
      }

      return rejectWithValue('Не удалось создать гостевую сессию');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Ошибка гостевого входа';

      return rejectWithValue(errorMessage);
    }
  },
);

export const loginUser = createAsyncThunk(
  'auth/login',
  async (
    credentials: { email: string; password: string },
    { rejectWithValue },
  ) => {
    try {
      // Demo-only authentication flow. Replace with the real API when available.
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return {
        id: 'demo-user',
        fullName: 'Demo User',
        email: credentials.email,
        avatar: './user.jpg',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Ошибка авторизации. Проверьте почту и пароль.';

      return rejectWithValue(errorMessage);
    }
  },
);

export const loginWithGoogle = createAsyncThunk(
  'auth/loginWithGoogle',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.loginWithGoogle();
      return response.user;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Ошибка авторизации через Google. Попробуйте позже.';

      return rejectWithValue(errorMessage);
    }
  },
);

export const loginWithFacebook = createAsyncThunk(
  'auth/loginWithFacebook',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.loginWithFacebook();
      return response.user;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Ошибка авторизации через Facebook. Попробуйте позже.';

      return rejectWithValue(errorMessage);
    }
  },
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (
    userData: { fullName: string; email: string; password: string },
    { rejectWithValue },
  ) => {
    try {
      // Demo-only registration flow. Replace with the real API when available.
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return {
        id: 'demo-user',
        fullName: userData.fullName,
        email: userData.email,
        avatar:
          'https://ui-avatars.com/api/?name=' +
          encodeURIComponent(userData.fullName),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Ошибка регистрации. Попробуйте позже.';

      return rejectWithValue(errorMessage);
    }
  },
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await dbService.closeCurrentSession();
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Ошибка при выходе. Попробуйте еще раз.';

      return rejectWithValue(errorMessage);
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    loginSuccess: (state, action: PayloadAction<User>) => {
      state.isLoading = false;
      state.isAuthenticated = true;
      state.user = action.payload;
      state.error = null;
      persistAuth(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
        persistAuth(action.payload);
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(loginWithGoogle.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        loginWithGoogle.fulfilled,
        (state, action: PayloadAction<User>) => {
          state.isLoading = false;
          state.isAuthenticated = true;
          state.user = action.payload;
          persistAuth(action.payload);
        },
      )
      .addCase(loginWithGoogle.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(loginWithFacebook.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        loginWithFacebook.fulfilled,
        (state, action: PayloadAction<User>) => {
          state.isLoading = false;
          state.isAuthenticated = true;
          state.user = action.payload;
          persistAuth(action.payload);
        },
      )
      .addCase(loginWithFacebook.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
        persistAuth(action.payload);
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(logoutUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        localStorage.removeItem('auth');
        localStorage.removeItem('guest_mode');
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(tryAutoLogin.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(tryAutoLogin.fulfilled, (state, action: PayloadAction<User>) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
        persistAuth(action.payload);
      })
      .addCase(tryAutoLogin.rejected, (state) => {
        state.isLoading = false;
      })
      .addCase(loginAsGuest.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginAsGuest.fulfilled, (state, action: PayloadAction<User>) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
        localStorage.setItem('guest_mode', 'true');
        persistAuth(action.payload);
      })
      .addCase(loginAsGuest.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, loginSuccess } = authSlice.actions;

export default authSlice.reducer;
