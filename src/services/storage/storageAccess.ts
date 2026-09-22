import type { Project } from '../../features/projects/projectsSlice';
import type { Task } from '../../features/tasks/tasksSlice';

export interface StorageSession {
  userId: string;
  provider?: string;
}

export const hasProjectAccess = (
  project: Project,
  session: StorageSession | null,
  isDemo: boolean
): boolean => {
  if (isDemo) return project.demoData === true;

  return Boolean(
    session &&
      !project.demoData &&
      (project.createdBy === session.userId ||
        project.teamMembers?.some(member => member.id === session.userId))
  );
};

export const hasTaskAccess = (
  task: Task,
  session: StorageSession | null,
  isDemo: boolean
): boolean => {
  if (isDemo) return task.demoData === true;

  return Boolean(
    session &&
      !task.demoData &&
      (task.assigneeId === session.userId || task.createdBy === session.userId)
  );
};
