import { db, handleDexieError } from './db';
import type { Task, TaskStatus, TaskUpdate } from '../../features/tasks/tasksSlice';
import { syncService } from './syncService';
import { generateId } from '../../utils';
import { dbService } from './dbService';

const hasTaskAccess = (
  task: Task,
  session: Awaited<ReturnType<typeof dbService.getCurrentSession>>,
  isDemo: boolean
): boolean => {
  if (isDemo) {
    return task.demoData === true;
  }

  return Boolean(
    session &&
    !task.demoData &&
    (task.assigneeId === session.userId || task.createdBy === session.userId)
  );
};

/**
 * Сервис для работы с задачами в локальном хранилище
 * Расширенная версия с полной поддержкой оффлайн-режима и синхронизации
 */
export const taskStorage = {
  /**
   * Получить все задачи
   */
  async getAllTasks(): Promise<Task[]> {
    try {
      // Проверяем, находимся ли мы в демо-режиме
      const session = await dbService.getCurrentSession();
      const isDemo = session?.provider === 'demo' || localStorage.getItem('demo_mode') === 'true';

      if (isDemo) {
        // В демо-режиме возвращаем только демо-задачи
        return await db.tasks
        .filter(task => task.demoData === true)
        .toArray();
      } else if (session) {
        // В обычном режиме возвращаем только задачи пользователя
        return await db.tasks
        .filter(task => hasTaskAccess(task, session, false))
        .toArray();
      }

      return [];
    } catch (error) {
      handleDexieError(error, 'Ошибка при получении задач');
      return []; // Никогда не выполнится, т.к. handleDexieError выбрасывает исключение
    }
  },

  /**
   * Получить задачи по статусу
   */
  async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    try {
      // Проверяем, находимся ли мы в демо-режиме
      const session = await dbService.getCurrentSession();
      const isDemo = session?.provider === 'demo' || localStorage.getItem('demo_mode') === 'true';

      if (isDemo) {
        // В демо-режиме возвращаем только демо-задачи с нужным статусом
        return await db.tasks
        .filter(task =>
          task.demoData === true &&
          task.status === status
        )
        .toArray();
      } else if (session) {
        // В обычном режиме возвращаем только задачи пользователя с нужным статусом
        return await db.tasks
        .filter(task => hasTaskAccess(task, session, false) && task.status === status)
        .toArray();
      }

      return [];
    } catch (error) {
      handleDexieError(error, `Ошибка при получении задач со статусом ${status}`);
      return [];
    }
  },

  /**
   * Получить задачи по проекту с оптимизированным запросом
   */
  async getTasksByProject(projectId: string): Promise<Task[]> {
    try {
      // Проверяем, находимся ли мы в демо-режиме
      const session = await dbService.getCurrentSession();
      const isDemo = session?.provider === 'demo' || localStorage.getItem('demo_mode') === 'true';

      if (isDemo) {
        // В демо-режиме возвращаем только демо-задачи для указанного проекта
        return await db.tasks
        .filter(task =>
          task.demoData === true &&
          task.projectId === projectId
        )
        .toArray();
      } else if (session) {
        // В обычном режиме возвращаем только задачи пользователя для указанного проекта
        return await db.tasks
        .filter(task => hasTaskAccess(task, session, false) && task.projectId === projectId)
        .toArray();
      }

      return [];
    } catch (error) {
      handleDexieError(error, `Ошибка при получении задач для проекта ${projectId}`);
      return [];
    }
  },

  /**
   * Получить задачу по ID с обработкой несуществующих данных
   */
  async getTaskById(id: string): Promise<Task | undefined> {
    try {
      const task = await db.tasks.get(id);

      if (!task) return undefined;

      // Проверяем, находимся ли мы в демо-режиме
      const session = await dbService.getCurrentSession();
      const isDemo = session?.provider === 'demo' || localStorage.getItem('demo_mode') === 'true';

      return hasTaskAccess(task, session, isDemo) ? task : undefined;
    } catch (error) {
      handleDexieError(error, `Ошибка при получении задачи с ID ${id}`);
      return undefined;
    }
  },

  /**
   * Добавить задачу
   */
  async addTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
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

      // Создаем новую задачу
      const newTask: Task = {
        id: generateId(),
        ...taskData,
        createdAt: timestamp,
        updatedAt: timestamp,
        demoData: isDemo, // Явно устанавливаем флаг демо-данных
        createdBy: session.userId // Добавляем создателя
      };

      // Добавляем задачу в транзакции для обеспечения целостности
      await db.runTransaction('readwrite', ['tasks'], async () => {
        // Сохраняем в локальную БД
        await db.tasks.add(newTask);
      });

      // Добавляем операцию в очередь синхронизации, если онлайн и не в демо-режиме
      if (navigator.onLine && !isDemo) {
        await syncService.addToSyncQueue('create', 'task', newTask);
      }

      return newTask;
    } catch (error) {
      handleDexieError(error, 'Ошибка при добавлении задачи');
      throw error;
    }
  },

  /**
   * Обновить задачу с проверкой существования и транзакциями
   */
  async updateTask(taskData: TaskUpdate & { id: string }): Promise<Task> {
    try {
      const session = await dbService.getCurrentSession();
      const isDemo =
        session?.provider === 'demo' ||
        localStorage.getItem('demo_mode') === 'true';

      const updatedTask = await db.runTransaction(
        'readwrite',
        ['tasks'],
        async () => {
          const existingTask = await db.tasks.get(taskData.id);

          if (!existingTask) {
            throw new Error(`Задача с ID ${taskData.id} не найдена`);
          }

          if (!hasTaskAccess(existingTask, session, isDemo)) {
            throw new Error(`Доступ к задаче с ID ${taskData.id} запрещен`);
          }

          const updatedTask: Task = {
            ...existingTask,
            ...taskData,
            updatedAt: new Date().toISOString(),
            demoData: existingTask.demoData,
            createdBy: existingTask.createdBy,
          };

          await db.tasks.put(updatedTask);
          return updatedTask;
        }
      );

      if (navigator.onLine && !isDemo) {
        await syncService.addToSyncQueue('update', 'task', updatedTask);
      }

      return updatedTask;
    } catch (error) {
      handleDexieError(error, `Ошибка при обновлении задачи с ID ${taskData.id}`);
      throw error;
    }
  },

  /**
   * Обновить статус задачи с упрощенным интерфейсом
   */
  async updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
    try {
      return await this.updateTask({ id, status });
    } catch (error) {
      handleDexieError(error, `Ошибка при обновлении статуса задачи с ID ${id}`);
      throw error;
    }
  },

  /**
   * Удалить задачу с дополнительными проверками
   */
  async deleteTask(id: string): Promise<void> {
    try {
      // Проверяем, находимся ли мы в демо-режиме
      const session = await dbService.getCurrentSession();
      const isDemo = session?.provider === 'demo' || localStorage.getItem('demo_mode') === 'true';

      // Получаем задачу отдельно
      const task = await db.tasks.get(id);
      if (!task) {
        throw new Error(`Задача с ID ${id} не найдена`);
      }

      if (!hasTaskAccess(task, session, isDemo)) {
        throw new Error(`Доступ к задаче с ID ${id} запрещен`);
      }

      // Удаляем задачу из БД в транзакции
      await db.runTransaction('readwrite', ['tasks'], async () => {
        await db.tasks.delete(id);
      });

      // ВНЕ транзакции: добавляем операцию в syncQueue если онлайн и не в демо-режиме
      if (navigator.onLine && !isDemo) {
        await syncService.addToSyncQueue('delete', 'task', { id });
      }
    } catch (error) {
      handleDexieError(error, `Ошибка при удалении задачи с ID ${id}`);
      throw error;
    }
  },

  /**
   * Поиск задач по тексту с оптимизированным алгоритмом
   */
  async searchTasks(searchText: string): Promise<Task[]> {
    if (!searchText.trim()) {
      return this.getAllTasks();
    }

    try {
      const query = searchText.toLowerCase().trim();

      // Получаем все задачи с учетом демо-режима и выполняем поиск в памяти
      const allTasks = await this.getAllTasks();

      return allTasks.filter(task => {
        return (
          task.title.toLowerCase().includes(query) ||
          (task.description && task.description.toLowerCase().includes(query))
        );
      });
    } catch (error) {
      handleDexieError(error, `Ошибка при поиске задач по запросу "${searchText}"`);
      return [];
    }
  },

  /**
   * Пакетное обновление задач с транзакцией
   */
  async bulkUpdateTasks(tasks: Array<TaskUpdate & { id: string }>): Promise<void> {
    try {
      const session = await dbService.getCurrentSession();
      if (!session) {
        throw new Error('Пользователь не авторизован');
      }

      const isDemo =
        session.provider === 'demo' ||
        localStorage.getItem('demo_mode') === 'true';
      const updatedTasks: Task[] = [];
      const timestamp = new Date().toISOString();

      await db.runTransaction('readwrite', ['tasks'], async () => {
        for (const taskData of tasks) {
          const existingTask = await db.tasks.get(taskData.id);

          if (!existingTask) {
            throw new Error(`Задача с ID ${taskData.id} не найдена`);
          }

          if (!hasTaskAccess(existingTask, session, isDemo)) {
            throw new Error(`Доступ к задаче с ID ${taskData.id} запрещен`);
          }

          const updatedTask: Task = {
            ...existingTask,
            ...taskData,
            updatedAt: timestamp,
            demoData: existingTask.demoData,
          };

          await db.tasks.update(taskData.id, updatedTask);
          updatedTasks.push(updatedTask);
        }
      });

      if (navigator.onLine && !isDemo) {
        for (const updatedTask of updatedTasks) {
          await syncService.addToSyncQueue('update', 'task', updatedTask);
        }
      }
    } catch (error) {
      handleDexieError(error, 'Ошибка при массовом обновлении задач');
      throw error;
    }
  },

  /**
   * Получить задачи с наступающими сроками
   * @param daysThreshold Количество дней до дедлайна
   */
  async getUpcomingTasks(daysThreshold: number = 7): Promise<Task[]> {
    try {
      if (daysThreshold < 0) {
        throw new Error('Количество дней должно быть неотрицательным');
      }

      const now = new Date();
      const thresholdDate = new Date();
      thresholdDate.setDate(now.getDate() + daysThreshold);

      const tasks = await this.getAllTasks();

      return tasks.filter(task => {
        if (!task.dueDate || task.status === 'done') {
          return false;
        }

        const dueDate = new Date(task.dueDate);
        return dueDate >= now && dueDate <= thresholdDate;
      });
    } catch (error) {
      handleDexieError(error, 'Ошибка при получении наступающих задач');
      return [];
    }
  }
};
