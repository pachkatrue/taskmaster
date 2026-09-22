import { describe, expect, it } from 'vitest';
import { hasProjectAccess, hasTaskAccess, type StorageSession } from './storageAccess';
import type { Project } from '../../features/projects/projectsSlice';
import type { Task } from '../../features/tasks/tasksSlice';

const user: StorageSession = { userId: 'user-1', provider: 'email' };

const project: Project = {
  id: 'project-1',
  title: 'Project',
  description: '',
  status: 'active',
  progress: 0,
  startDate: '',
  endDate: '',
  teamMembers: [{ id: 'user-1', name: 'User' }],
  createdAt: '',
  updatedAt: '',
  createdBy: 'owner',
  demoData: false,
};

const task: Task = {
  id: 'task-1',
  title: 'Task',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: '',
  createdAt: '',
  updatedAt: '',
  createdBy: 'owner',
  assigneeId: 'user-1',
  demoData: false,
};

describe('storage access guards', () => {
  it('allows demo records only in demo mode', () => {
    expect(hasProjectAccess({ ...project, demoData: true }, user, true)).toBe(true);
    expect(hasTaskAccess({ ...task, demoData: true }, user, true)).toBe(true);
    expect(hasProjectAccess(project, user, true)).toBe(false);
    expect(hasTaskAccess(task, user, true)).toBe(false);
  });

  it('allows project owners and members in normal mode', () => {
    expect(hasProjectAccess(project, user, false)).toBe(true);
    expect(hasProjectAccess({ ...project, createdBy: 'user-1', teamMembers: [] }, user, false)).toBe(true);
    expect(hasProjectAccess({ ...project, createdBy: 'other', teamMembers: [] }, user, false)).toBe(false);
  });

  it('allows task assignees and creators in normal mode', () => {
    expect(hasTaskAccess(task, user, false)).toBe(true);
    expect(hasTaskAccess({ ...task, assigneeId: 'other', createdBy: 'user-1' }, user, false)).toBe(true);
    expect(hasTaskAccess({ ...task, assigneeId: 'other', createdBy: 'other' }, user, false)).toBe(false);
  });

  it('denies normal records without a session', () => {
    expect(hasProjectAccess(project, null, false)).toBe(false);
    expect(hasTaskAccess(task, null, false)).toBe(false);
  });
});
