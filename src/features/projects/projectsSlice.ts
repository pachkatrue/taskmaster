import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { projectStorage } from '../../services/storage/projectStorage';

// Типы для проектов
export type ProjectStatus = 'planning' | 'active' | 'completed' | 'onHold';

export type ProjectUpdate = Partial<Pick<
  Project,
  'title' | 'description' | 'status' | 'progress' | 'startDate' | 'endDate' | 'teamMembers'
>>;

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  progress: number; // 0 - 100
  startDate: string;
  endDate: string;
  teamMembers: {
    id: string;
    name: string;
    avatar?: string;
  }[];
  createdAt: string;
  updatedAt: string;
  demoData?: boolean; // Добавляем флаг демо-данных
  createdBy?: string; // Добавляем поле для определения создателя
}

interface ProjectsState {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
}

// Начальное состояние
const initialState: ProjectsState = {
  projects: [],
  isLoading: false,
  error: null,
};

// Асинхронные экшены для проектов с использованием хранилища
export const fetchProjects = createAsyncThunk(
  'projects/fetchProjects',
  async (_, { rejectWithValue }) => {
    try {
      // Получаем проекты из локального хранилища
      return await projectStorage.getAllProjects();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при загрузке проектов. Попробуйте еще раз.'
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchProjectById = createAsyncThunk(
  'projects/fetchProjectById',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const project = await projectStorage.getProjectById(projectId);

      if (!project) {
        return rejectWithValue('Проект не найден');
      }

      return project;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при загрузке проекта. Попробуйте еще раз.'
      return rejectWithValue(errorMessage);
    }
  }
);

export const createProject = createAsyncThunk(
  'projects/createProject',
  async (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>, { rejectWithValue }) => {
    try {
      // Добавляем проект в хранилище
      return await projectStorage.addProject(projectData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при создании проекта. Попробуйте еще раз.'
      return rejectWithValue(errorMessage);
    }
  }
);


export const updateProject = createAsyncThunk(
  'projects/updateProject',
  async (projectData: ProjectUpdate & { id: string }, { rejectWithValue }) => {
    try {
      // Обновляем проект в хранилище
      return await projectStorage.updateProject(projectData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при обновлении проекта. Попробуйте еще раз.'
      return rejectWithValue(errorMessage);
    }
  }
);

export const deleteProject = createAsyncThunk(
  'projects/deleteProject',
  async (projectId: string, { rejectWithValue }) => {
    try {
      // Удаляем проект из хранилища
      await projectStorage.deleteProject(projectId);
      return projectId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при удалении проекта. Попробуйте еще раз.'
      return rejectWithValue(errorMessage);
    }
  }
);

// Дополнительные специализированные экшены
export const fetchProjectsByStatus = createAsyncThunk(
  'projects/fetchProjectsByStatus',
  async (status: ProjectStatus, { rejectWithValue }) => {
    try {
      return await projectStorage.getProjectsByStatus(status);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Ошибка при загрузке проектов со статусом ${status}.`
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchActiveProjects = createAsyncThunk(
  'projects/fetchActiveProjects',
  async (_, { rejectWithValue }) => {
    try {
      return await projectStorage.getActiveProjects();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при загрузке активных проектов.'
      return rejectWithValue(errorMessage);
    }
  }
);

export const searchProjects = createAsyncThunk(
  'projects/searchProjects',
  async (searchText: string, { rejectWithValue }) => {
    try {
      return await projectStorage.searchProjects(searchText);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Ошибка при поиске проектов по запросу "${searchText}".`
      return rejectWithValue(errorMessage);
    }
  }
);

export const addTeamMember = createAsyncThunk(
  'projects/addTeamMember',
  async (
    { projectId, member }: {
      projectId: string;
      member: { id: string; name: string; avatar?: string }
    },
    { rejectWithValue }
  ) => {
    try {
      return await projectStorage.addTeamMember(projectId, member);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при добавлении участника в проект.'
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeTeamMember = createAsyncThunk(
  'projects/removeTeamMember',
  async (
    { projectId, memberId }: { projectId: string; memberId: string },
    { rejectWithValue }
  ) => {
    try {
      return await projectStorage.removeTeamMember(projectId, memberId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при удалении участника из проекта.'
      return rejectWithValue(errorMessage);
    }
  }
);

// Создание среза
const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    clearProjectsError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Обработка состояний получения проектов
    builder.addCase(fetchProjects.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    })
    .addCase(fetchProjects.fulfilled, (state, action: PayloadAction<Project[]>) => {
      state.isLoading = false;
      state.projects = action.payload;
    })
    .addCase(fetchProjects.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    })

    // Обработка получения проекта по ID
    .addCase(fetchProjectById.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    })
    .addCase(fetchProjectById.fulfilled, (state, action: PayloadAction<Project>) => {
      state.isLoading = false;
      // Обновляем проект в списке, если он уже там есть
      const index = state.projects.findIndex(project => project.id === action.payload.id);
      if (index !== -1) {
        state.projects[index] = action.payload;
      } else {
        state.projects.push(action.payload);
      }
    })
    .addCase(fetchProjectById.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    })

    // Обработка состояний создания проекта
    .addCase(createProject.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    })
    .addCase(createProject.fulfilled, (state, action: PayloadAction<Project>) => {
      state.isLoading = false;
      state.projects.push(action.payload);
    })
    .addCase(createProject.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    })

    // Обработка состояний обновления проекта
    .addCase(updateProject.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    })
    .addCase(updateProject.fulfilled, (state, action: PayloadAction<Project>) => {
      state.isLoading = false;
      const index = state.projects.findIndex(project => project.id === action.payload.id);
      if (index !== -1) {
        state.projects[index] = action.payload;
      }
    })
    .addCase(updateProject.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    })

    // Обработка состояний удаления проекта
    .addCase(deleteProject.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    })
    .addCase(deleteProject.fulfilled, (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.projects = state.projects.filter(project => project.id !== action.payload);
    })
    .addCase(deleteProject.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    })

    // Обработка получения проектов по статусу
    .addCase(fetchProjectsByStatus.fulfilled, (state, action: PayloadAction<Project[]>) => {
      state.isLoading = false;
      state.projects = action.payload;
    })

    // Обработка получения активных проектов
    .addCase(fetchActiveProjects.fulfilled, (state, action: PayloadAction<Project[]>) => {
      state.isLoading = false;
      state.projects = action.payload;
    })

    // Обработка поиска проектов
    .addCase(searchProjects.fulfilled, (state, action: PayloadAction<Project[]>) => {
      state.isLoading = false;
      state.projects = action.payload;
    })

    // Обработка добавления участника в проект
    .addCase(addTeamMember.fulfilled, (state, action: PayloadAction<Project>) => {
      const index = state.projects.findIndex(project => project.id === action.payload.id);
      if (index !== -1) {
        state.projects[index] = action.payload;
      }
    })

    // Обработка удаления участника из проекта
    .addCase(removeTeamMember.fulfilled, (state, action: PayloadAction<Project>) => {
      const index = state.projects.findIndex(project => project.id === action.payload.id);
      if (index !== -1) {
        state.projects[index] = action.payload;
      }
    });
  },
});

export const { clearProjectsError } = projectsSlice.actions;

export default projectsSlice.reducer;