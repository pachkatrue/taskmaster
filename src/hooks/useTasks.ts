import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  Task,
  TaskStatus,
  TaskPriority
} from '../features/tasks/tasksSlice';

/**
 * Хук для работы с задачами
 * Предоставляет интерфейс для CRUD-операций над задачами
 */
export const useTasks = () => {
  const dispatch = useAppDispatch();
  const { tasks, isLoading, error } = useAppSelector(state => state.tasks);

  // Загрузка задач с учетом демо-режима
  const loadTasks = useCallback(() => {
    return dispatch(fetchTasks()).unwrap();
  }, [dispatch]);

  // Создание новой задачи
  const addTask = useCallback(
    (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
      return dispatch(createTask(taskData));
    },
    [dispatch]
  );

  // Обновление задачи
  const editTask = useCallback(
    (taskData: Partial<Task> & { id: string }) => {
      return dispatch(updateTask(taskData));
    },
    [dispatch]
  );

  // Изменение статуса задачи
  const changeTaskStatus = useCallback(
    (taskId: string, status: TaskStatus) => {
      return dispatch(updateTaskStatus({ taskId, status }));
    },
    [dispatch]
  );

  // Удаление задачи
  const removeTask = useCallback(
    (taskId: string) => {
      return dispatch(deleteTask(taskId));
    },
    [dispatch]
  );

  // Фильтрация задач по статусу
  const getTasksByStatus = useCallback(
    (status: TaskStatus) => {
      return tasks.filter(task => task.status === status);
    },
    [tasks]
  );

  // Фильтрация задач по проекту
  const getTasksByProject = useCallback(
    (projectId: string) => {
      return tasks.filter(task => task.projectId === projectId);
    },
    [tasks]
  );

  // Фильтрация задач по приоритету
  const getTasksByPriority = useCallback(
    (priority: TaskPriority) => {
      return tasks.filter(task => task.priority === priority);
    },
    [tasks]
  );

  // Фильтрация задач по исполнителю
  const getTasksByAssignee = useCallback(
    (assigneeId: string) => {
      return tasks.filter(task => task.assigneeId === assigneeId);
    },
    [tasks]
  );

  // Получение задачи по ID
  const getTaskById = useCallback(
    (taskId: string) => {
      return tasks.find(task => task.id === taskId);
    },
    [tasks]
  );

  return {
    tasks,
    isLoading,
    error,
    loadTasks,
    addTask,
    editTask,
    removeTask,
    changeTaskStatus,
    getTasksByStatus,
    getTasksByProject,
    getTasksByPriority,
    getTasksByAssignee,
    getTaskById
  };
};