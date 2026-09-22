import { db, handleDexieError } from './db';
import type { Project, ProjectStatus, ProjectUpdate } from '../../features/projects/projectsSlice';
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

          await db.projects.update(projectData.id, updatedProject);
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
      // Проверяем, находимся ли мы в демо-режиме
      const session = await dbService.getCurrentSession();
      const isDemo = session?.provider === 'demo' || localStorage.getItem('demo_mode') === 'true';

      // Используем транзакцию для согласованной обработки проекта и связанных задач
      await db.runTransaction('readwrite', ['projects', 'tasks'], async () => {
        // Сначала получаем проект для синхронизации
        const project = await db.projects.get(id);

        if (!project) {
          throw new Error(`Проект с ID ${id} не найден`);
        }

        // Проверяем доступ к проекту
        if ((isDemo && !project.demoData) ||
          (!isDemo && project.demoData)) {
          throw new Error(`Доступ к проекту с ID ${id} запрещен`);
        }

        // Получаем связанные задачи
        const projectTasks = await taskStorage.getTasksByProject(id);

        // Удаляем проект из локальной БД
        await db.projects.delete(id);

        // Добавляем операцию удаления проекта в очередь синхронизации если онлайн и не в демо-режиме
        if (navigator.onLine && !isDemo) {
          await syncService.addToSyncQueue('delete', 'project', { id });
        }

        // Обновляем связанные задачи - удаляем ссылку на проект
        for (const task of projectTasks) {
          await db.tasks.update(task.id, {
            projectId: undefined,
            updatedAt: new Date().toISOString()
          });

          // Добавляем операцию обновления задачи в очередь синхронизации если онлайн и не в демо-режиме
          if (navigator.onLine && !isDemo) {
            await syncService.addToSyncQueue('update', 'task', {
              ...task,
              projectId: undefined,
              updatedAt: new Date().toISOString()
            });
          }
        }
      });
    } catch (error) {
      handleDexieError(error, `Ошибка при удалении проекта с ID ${id}`);
      throw error;
    }
  },

  /**
   * Добавить участника в проект с безопасной обработкой массива
   */
  async addTeamMember(
    projectId: string,
    member: { id: string; name: string; avatar?: string }
  ): Promise<Project> {
    try {
      return await db.runTransaction('readwrite', ['projects'], async () => {
        const project = await db.projects.get(projectId);

        if (!project) {
          throw new Error(`Проект с ID ${projectId} не найден`);
        }

        // Проверяем, нет ли уже такого участника
        const isExistingMember = project.teamMembers.some(m => m.id === member.id);

        if (isExistingMember) {
          return project; // Участник уже существует, просто возвращаем проект
        }

        // Создаем новый массив участников, а не модифицируем существующий
        const updatedTeamMembers = [...project.teamMembers, member];

        // Обновляем проект
        const updatedProject: Project = {
          ...project,
          teamMembers: updatedTeamMembers,
          updatedAt: new Date().toISOString()
        };

        // Сохраняем в БД
        const { id, ...fieldsToUpdate } = updatedProject;
        await db.projects.update(id, fieldsToUpdate);

        // Добавляем в очередь синхронизации
        if (navigator.onLine) {
          await syncService.addToSyncQueue('update', 'project', updatedProject);
        }

        return updatedProject;
      });
    } catch (error) {
      handleDexieError(error, `Ошибка при добавлении участника в проект с ID ${projectId}`);
      throw error;
    }
  },

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
      // Используем транзакцию для согласованных операций
      return await db.runTransaction('readwrite', ['projects', 'tasks'], async () => {
        const project = await db.projects.get(id);

        if (!project) {
          throw new Error(`Проект с ID ${id} не найден`);
        }

        // Если прогресс не указан, рассчитываем на основе задач проекта
        if (progress === undefined) {
          const tasks = await taskStorage.getTasksByProject(id);

          if (tasks.length === 0) {
            progress = 0;
          } else {
            // Считаем завершенные задачи
            const completedTasks = tasks.filter(task => task.status === 'done').length;
            progress = Math.round((completedTasks / tasks.length) * 100);
          }
        }

        // Обновляем прогресс
        const updatedProject: Project = {
          ...project,
          progress,
          updatedAt: new Date().toISOString()
        };

        // Сохраняем в БД
        const { id: projectId, ...fieldsToUpdate } = updatedProject;
        await db.projects.update(projectId, fieldsToUpdate);

        // Добавляем в очередь синхронизации
        if (navigator.onLine) {
          await syncService.addToSyncQueue('update', 'project', updatedProject);
        }

        return updatedProject;
      });
    } catch (error) {
      handleDexieError(error, `Ошибка при обновлении прогресса проекта с ID ${id}`);
      throw error;
    }
  }
};