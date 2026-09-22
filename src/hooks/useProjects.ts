import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  fetchProjects,
  fetchProjectById,
  createProject,
  updateProject,
  deleteProject,
  updateProjectProgress,
  Project,
  ProjectStatus
} from '../features/projects/projectsSlice';

/**
 * Хук для работы с проектами
 * Предоставляет интерфейс для CRUD-операций над проектами
 */
export const useProjects = () => {
  const dispatch = useAppDispatch();
  const { projects, isLoading, error } = useAppSelector(state => state.projects);

  // Загрузка проектов с учетом демо-режима
  const loadProjects = useCallback(async () => {
    dispatch(fetchProjectsStart());
    try {
      // Используем новый метод для получения проектов в зависимости от типа аккаунта
      const userProjects = await dbService.getUserProjects();
      dispatch(fetchProjectsSuccess(userProjects));
      return userProjects;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при загрузке проектов';
      dispatch(fetchProjectsError(errorMessage));
      throw error;
    }
  }, [dispatch]);

  // Загрузка проекта по ID
  const loadProject = useCallback(
    (projectId: string) => {
      return dispatch(fetchProjectById(projectId));
    },
    [dispatch]
  );

  // Создание нового проекта
  const addProject = useCallback(
    (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
      return dispatch(createProject(projectData));
    },
    [dispatch]
  );

  // Обновление проекта
  const editProject = useCallback(
    (projectData: Partial<Project> & { id: string }) => {
      return dispatch(updateProject(projectData));
    },
    [dispatch]
  );

  // Изменение прогресса проекта
  const changeProjectProgress = useCallback(
    (projectId: string, progress: number) => {
      return dispatch(updateProjectProgress({ projectId, progress }));
    },
    [dispatch]
  );

  // Удаление проекта
  const removeProject = useCallback(
    (projectId: string) => {
      return dispatch(deleteProject(projectId));
    },
    [dispatch]
  );

  // Фильтрация проектов по статусу
  const getProjectsByStatus = useCallback(
    (status: ProjectStatus) => {
      return projects.filter(project => project.status === status);
    },
    [projects]
  );

  // Поиск проекта по ID
  const getProjectById = useCallback(
    (projectId: string) => {
      return projects.find(project => project.id === projectId);
    },
    [projects]
  );

  // Получение активных проектов
  const getActiveProjects = useCallback(
    () => {
      return projects.filter(project => project.status === 'active');
    },
    [projects]
  );

  return {
    projects,
    isLoading,
    error,
    loadProjects,
    loadProject,
    addProject,
    editProject,
    removeProject,
    changeProjectProgress,
    getProjectsByStatus,
    getProjectById,
    getActiveProjects
  };
};