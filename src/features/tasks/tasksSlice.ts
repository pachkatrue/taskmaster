import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { taskStorage } from '../../services/storage/taskStorage';

// Типы для задач
export type TaskStatus = 'todo' | 'inProgress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  projectId?: string;
  assigneeId?: string;
  assignee?: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
  demoData?: boolean; // Добавляем флаг демо-данных
  createdBy?: string; // Добавляем поле для определения создателя
}

interface TasksState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
}

// Начальное состояние
const initialState: TasksState = {
  tasks: [],
  isLoading: false,
  error: null,
};

// Асинхронные экшены для задач, использующие хранилище вместо моков
export const fetchTasks = createAsyncThunk(
  'tasks/fetchTasks',
  async (_, { rejectWithValue }) => {
    try {
      // Получаем задачи из локального хранилища
      return await taskStorage.getAllTasks();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при загрузке задач. Попробуйте еще раз.'
      return rejectWithValue(errorMessage);
    }
  }
);

export const createTask = createAsyncThunk(
  'tasks/createTask',
  async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>, { rejectWithValue }) => {
    try {
      // Добавляем задачу в хранилище
      return await taskStorage.addTask(taskData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при создании задачи. Попробуйте еще раз.'
      return rejectWithValue(errorMessage);
    }
  }
);

export const updateTaskStatus = createAsyncThunk(
  'tasks/updateTaskStatus',
  async (
    { taskId, status }: { taskId: string; status: TaskStatus },
    { rejectWithValue }
  ) => {
    try {
      return await taskStorage.updateTaskStatus(taskId, status);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Ошибка при обновлении статуса задачи. Попробуйте еще раз.';
      return rejectWithValue(errorMessage);
    }
  }
);

export const updateTask = createAsyncThunk(
  'tasks/updateTask',
  async (taskData: Partial<Task> & { id: string }, { rejectWithValue }) => {
    try {
      // Обновляем задачу в хранилище
      return await taskStorage.updateTask(taskData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при обновлении задачи. Попробуйте еще раз.'
      return rejectWithValue(errorMessage);
    }
  }
);

export const deleteTask = createAsyncThunk(
  'tasks/deleteTask',
  async (taskId: string, { rejectWithValue }) => {
    try {
      // Удаляем задачу из хранилища
      await taskStorage.deleteTask(taskId);
      return taskId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при удалении задачи. Попробуйте еще раз.'
      return rejectWithValue(errorMessage);
    }
  }
);

// Дополнительные специализированные экшены
export const fetchTasksByProject = createAsyncThunk(
  'tasks/fetchTasksByProject',
  async (projectId: string, { rejectWithValue }) => {
    try {
      return await taskStorage.getTasksByProject(projectId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Ошибка при загрузке задач для проекта ${projectId}.`
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchTasksByStatus = createAsyncThunk(
  'tasks/fetchTasksByStatus',
  async (status: TaskStatus, { rejectWithValue }) => {
    try {
      return await taskStorage.getTasksByStatus(status);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Ошибка при загрузке задач со статусом ${status}.`
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchTasks = createAsyncThunk(
  'tasks/searchTasks',
  async (searchText: string, { rejectWithValue }) => {
    try {
      return await taskStorage.searchTasks(searchText);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Ошибка при поиске задач по запросу "${searchText}".`
      return rejectWithValue(errorMessage);
    }
  }
);

// Создание среза
const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    clearTasksError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Обработка состояний получения задач
    builder
    .addCase(fetchTasksStart, (state) => {
      state.isLoading = true;
      state.error = null;
    })
    .addCase(fetchTasksSuccess, (state, action: PayloadAction<Task[]>) => {
      state.isLoading = false;
      state.error = null;
      state.tasks = action.payload;
    })
    .addCase(fetchTasksError, (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    })

    .addCase(fetchTasks.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    })
    .addCase(fetchTasks.fulfilled, (state, action: PayloadAction<Task[]>) => {
      state.isLoading = false;
      state.tasks = action.payload;
    })
    .addCase(fetchTasks.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    })

    // Обработка состояний создания задачи
    .addCase(createTask.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    })
    .addCase(createTask.fulfilled, (state, action: PayloadAction<Task>) => {
      state.isLoading = false;
      state.tasks.push(action.payload);
    })
    .addCase(createTask.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    })

    // Обработка состояний обновления задачи
    .addCase(updateTask.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    })
    .addCase(updateTask.fulfilled, (state, action: PayloadAction<Task>) => {
      state.isLoading = false;
      const index = state.tasks.findIndex(task => task.id === action.payload.id);
      if (index !== -1) {
        state.tasks[index] = action.payload;
      }
    })
    .addCase(updateTask.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    })

    // Обработка изменения статуса задачи
    .addCase(updateTaskStatus.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    })
    .addCase(updateTaskStatus.fulfilled, (state, action: PayloadAction<Task>) => {
      state.isLoading = false;
      const index = state.tasks.findIndex(task => task.id === action.payload.id);

      if (index !== -1) {
        state.tasks[index] = action.payload;
      }
    })
    .addCase(updateTaskStatus.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    })

    // Обработка состояний удаления задачи
    .addCase(deleteTask.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    })
    .addCase(deleteTask.fulfilled, (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.tasks = state.tasks.filter(task => task.id !== action.payload);
    })
    .addCase(deleteTask.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    })

    // Обработка получения задач по проекту
    .addCase(fetchTasksByProject.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    })
    .addCase(fetchTasksByProject.fulfilled, (state, action: PayloadAction<Task[]>) => {
      state.isLoading = false;
      state.tasks = action.payload;
    })
    .addCase(fetchTasksByProject.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    })

    // Обработка получения задач по статусу
    .addCase(fetchTasksByStatus.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    })
    .addCase(fetchTasksByStatus.fulfilled, (state, action: PayloadAction<Task[]>) => {
      state.isLoading = false;
      state.tasks = action.payload;
    })
    .addCase(fetchTasksByStatus.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    })

    // Обработка поиска задач
    .addCase(searchTasks.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    })
    .addCase(searchTasks.fulfilled, (state, action: PayloadAction<Task[]>) => {
      state.isLoading = false;
      state.tasks = action.payload;
    })
    .addCase(searchTasks.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
  },
});

export const { clearTasksError } = tasksSlice.actions;

export default tasksSlice.reducer;