import { db, handleDexieError } from './db';
import type { Project, ProjectStatus, ProjectUpdate } from '../../features/projects/projectsSlice';
import type { Task } from '../../features/tasks/tasksSlice';
import { syncService } from './syncService';
import { generateId } from '../../utils';
import { taskStorage } from './taskStorage';
import { dbService } from './dbService';

const hasProjectAccess = (
  project: Project,
  session: Awaited<ReturnType<typeof dbService.getCurrentSession>>,
  isDemo: boolean
): boolean => {
  if (isDemo) {
    return project.demoData === true;
  }

  return Boolean(
    session &&
    !project.demoData &&
    (project.createdBy === session.userId ||
      project.teamMembers?.some(member => member.id === session.userId))
  );
};

/**
 * Сервис для работы с проектами в локальном хранилище
 * Расширенная версия с полной поддержкой оффлайн-режима и синхронизации
 */
export const projectStorage = {
  /**
   * Получить все проекты
   */
  async getAllProjects(): Promise<Project[]> {
    try {
      // Проверяем, находимся ли мы в демо-режиме
      const session = await dbService.getCurrentSession();
      const isDemo = session?.provider === 'demo' || localStorage.getItem('demo_mode') === 'true';

      if (isDemo) {
        // В демо-режиме возвращаем только демо-проекты
        return await db.projects
        .filter(project => project.demoData === true)
        .toArray();
      } else if (session) {
        // В обычном режиме возвращаем только проекты пользователя
        return await db.projects
        .filter(project =>
          !project.demoData &&
          (project.teamMembers?.some(member => member.id === session.userId) ||
            project.createdBy === session.userId)
        )
        .toArray();
      }

      return [];
    } catch (error) {
      handleDexieError(error, 'Ошибка при получении проектов');
      return [];
    }
  },

  /**
   * Получить проект по ID с обработкой ошибок
   */
  async getProjectById(id: string): Promise<Project | undefined> {
    try {
      const project = await db.projects.get(id);

      if (!project) return undefined;

      // Проверяем, находимся ли мы в демо-режиме
      const session = await dbService.getCurrentSession();
      const isDemo = session?.provider === 'demo' || localStorage.getItem('demo_mode') === 'true';

      // Проверяем доступ к проекту
      if ((isDemo && project.demoData) ||
        (!isDemo && !project.demoData && session &&
          (project.teamMembers?.some(member => member.id === session.userId) ||
            project.createdBy === session.userId))) {
        return project;
      }

      return undefined;
    } catch (error) {
      handleDexieError(error, `Ошибка при получении проекта с ID ${id}`);
      return undefined;
    }
  },

  /**
   * Обновить статус проекта
   */
  async updateProjectStatus(id: string, status: ProjectStatus): Promise<Project> {
    return this.updateProject({ id, status });
  },

  /**
   * Удалить участника из проекта
   */
  async removeTeamMember(projectId: string, memberId: string): Promise<Project> {
    // Получаем проект по ID с проверкой прав доступа
    const project = await this.getProjectById(projectId);

    if (!project) {
      throw new Error(`Проект с ID ${projectId} не найден или доступ запрещен`);
    }

    return await this.updateProject({
      id: projectId,
      teamMembers: project.teamMembers.filter(m => m.id !== memberId)
    });
  },

  /**
   * Получить все активные проекты
   */
  async getActiveProjects(): Promise<Project[]> {
    try {
      // Использовем getAllProjects для получения проектов с учетом демо-режима
      const projects = await this.getAllProjects();
      return projects.filter(project => project.status === 'active');
    } catch (error) {
      handleDexieError(error, 'Ошибка при получении активных проектов');
      return [];
    }
  },

  /**
   * Получить проекты по статусу
   */
  async getProjectsByStatus(status: ProjectStatus): Promise<Project[]> {
    try {
      // Использовем getAllProjects для получения проектов с учетом демо-режима
      const projects = await this.getAllProjects();
      return projects.filter(project => project.status === status);
    } catch (error) {
      handleDexieError(error, `Ошибка при получении проектов со статусом "${status}"`);
      return [];
    }
  },

  /**
   * Добавить проект с транзакцией
   */
  async addProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    try {
      const timestamp = new Date().toISOString();

      // Проверяем, находимся ли мы в демо-режиме
      const session = await dbService.getCurrentSession();
      if (!session) {
        throw new Error('Пользователь не авторизован');
      }

      const isDemo =
        session.provider === 'demo' ||
        localStorage.getItem('demo_mode') === 'true';

      // Создаем новый проект
      const newProject: Project = {
        id: generateId(),
        ...projectData,
        createdAt: timestamp,
        updatedAt: timestamp,
        demoData: isDemo, // Явно устанавливаем флаг демо-данных
        createdBy: session.userId // Добавляем создателя
      };

      // Используем транзакцию для обеспечения целостности
      await db.runTransaction('readwrite', ['projects'], async () => {
        // Сохраняем в локальную БД
        await db.projects.add(newProject);
      });

      // Добавляем операцию в очередь синхронизации если онлайн и не в демо-режиме
      if (navigator.onLine && !isDemo) {
        await syncService.addToSyncQueue('create', 'project', newProject);
      }

      return newProject;
    } catch (error) {
      handleDexieError(error, 'Ошибка при добавлении проекта');
      throw error;
    }
  },

  /**
   * Обновить проект с использованием транзакций
   */
  async updateProject(projectData: ProjectUpdate & { id: string }): Promise<Project> {
    try {
      const session = await dbService.getCurrentSession();
      const isDemo =
        session?.provider === 'demo' ||
        localStorage.getItem('demo_mode') === 'true';

      const updatedProject = await db.runTransaction(
        'readwrite',
        ['projects'],
        async () => {
          const existingProject = await db.projects.get(projectData.id);

          if (!existingProject) {
            throw new Error(`Проект с ID ${projectData.id} не найден`);
          }

          if (!hasProjectAccess(existingProject, session, isDemo)) {
            throw new Error(`Доступ к проекту с ID ${projectData.id} запрещен`);
          }

          const updatedProject: Project = {
            ...existingProject,
            ...projectData,
            updatedAt: new Date().toISOString(),
            demoData: existingProject.demoData,
            createdBy: existingProject.createdBy,
          };

          await db.projects.put(updatedProject);
          return updatedProject;
        }
      );

      if (navigator.onLine && !isDemo) {
        await syncService.addToSyncQueue('update', 'project', updatedProject);
      }

      return updatedProject;
    } catch (error) {
      handleDexieError(error, `Ошибка при обновлении проекта с ID ${projectData.id}`);
      throw error;
    }
  },

  /**
   * Удалить проект с обработкой связанных задач в транзакции
   */
  async deleteProject(id: string): Promise<void> {
    try {
      const session = await dbService.getCurrentSession();
      const isDemo = session?.provider === 'demo' || localStorage.getItem('demo_mode') === 'true';
      const updatedTasks: Task[] = [];

      await db.runTransaction('readwrite', ['projects', 'tasks'], async () => {
        const project = await db.projects.get(id);

        if (!project) {
          throw new Error(`Проект с ID ${id} не найден`);
        }

        if (!hasProjectAccess(project, session, isDemo)) {
          throw new Error(`Доступ к проекту с ID ${id} запрещен`);
        }

        const projectTasks = await db.tasks.where('projectId').equals(id).toArray();
        const timestamp = new Date().toISOString();

        await db.projects.delete(id);

        for (const task of projectTasks) {
          const updatedTask: Task = {
            ...task,
            projectId: undefined,
            updatedAt: timestamp,
          };

          await db.tasks.put(updatedTask);
          updatedTasks.push(updatedTask);
        }
      });

      if (navigator.onLine && !isDemo) {
        await syncService.addToSyncQueue('delete', 'project', { id });

        for (const task of updatedTasks) {
          await syncService.addToSyncQueue('update', 'task', task);
        }
      }
    } catch (error) {
      handleDexieError(error, `Ошибка при удалении проекта с ID ${id}`);
      throw error;
    }
  }

  /**
   * Добавить участника в проект с безопасной обработкой массива
   */
  async addTeamMember(
    projectId: string,
    member: { id: string; name: string; avatar?: string }
  ): Promise<Project> {
    try {
      const session = await dbService.getCurrentSession();
      const isDemo = session?.provider === 'demo' || localStorage.getItem('demo_mode') === 'true';

      const updatedProject = await db.runTransaction('readwrite', ['projects'], async () => {
        const project = await db.projects.get(projectId);

        if (!project) {
          throw new Error(`Проект с ID ${projectId} не найден`);
        }

        if (!hasProjectAccess(project, session, isDemo)) {
          throw new Error(`Доступ к проекту с ID ${projectId} запрещен`);
        }

        if (project.teamMembers.some(m => m.id === member.id)) {
          return project;
        }

        const updatedProject: Project = {
          ...project,
          teamMembers: [...project.teamMembers, member],
          updatedAt: new Date().toISOString(),
        };

        await db.projects.put(updatedProject);
        return updatedProject;
      });

      if (navigator.onLine && !isDemo) {
        await syncService.addToSyncQueue('update', 'project', updatedProject);
      }

      return updatedProject;
    } catch (error) {
      handleDexieError(error, `Ошибка при добавлении участника в проект с ID ${projectId}`);
      throw error;
    }
  }

  /**
   * Поиск задач по тексту с оптимизированным алгоритмом
   */
  async searchProjects(query: string): Promise<Project[]> {
    try {
      const queryLower = query.toLowerCase().trim();

      // Используем getAllProjects для учета демо-режима
      const allProjects = await this.getAllProjects();

      return allProjects.filter(project =>
        project.title.toLowerCase().includes(queryLower) ||
        (project.description && project.description.toLowerCase().includes(queryLower))
      );
    } catch (error) {
      handleDexieError(error, `Ошибка при поиске проектов по запросу "${query}"`);
      return [];
    }
  },

  /**
   * Обновить прогресс проекта с опциональным автоматическим расчетом
   */
  async updateProjectProgress(id: string, progress?: number): Promise<Project> {
    try {
      const session = await dbService.getCurrentSession();
      const isDemo = session?.provider === 'demo' || localStorage.getItem('demo_mode') === 'true';

      const updatedProject = await db.runTransaction(
        'readwrite',
        ['projects', 'tasks'],
        async () => {
          const project = await db.projects.get(id);

          if (!project) {
            throw new Error(`Проект с ID ${id} не найден`);
          }

          if (!hasProjectAccess(project, session, isDemo)) {
            throw new Error(`Доступ к проекту с ID ${id} запрещен`);
          }

          let nextProgress = progress;

          if (nextProgress === undefined) {
            const tasks = await db.tasks.where('projectId').equals(id).toArray();
            nextProgress = tasks.length === 0
              ? 0
              : Math.round((tasks.filter(task => task.status === 'done').length / tasks.length) * 100);
          }

          const updatedProject: Project = {
            ...project,
            progress: Math.min(100, Math.max(0, nextProgress ?? 0)),
            updatedAt: new Date().toISOString(),
          };

          await db.projects.put(updatedProject);
          return updatedProject;
        }
      );

      if (navigator.onLine && !isDemo) {
        await syncService.addToSyncQueue('update', 'project', updatedProject);
      }

      return updatedProject;
    } catch (error) {
      handleDexieError(error, `Ошибка при обновлении прогресса проекта с ID ${id}`);
      throw error;
    }
  }

};