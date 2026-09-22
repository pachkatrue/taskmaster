import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';
import { syncService } from './syncService';
import { SyncTransportError } from './syncTransport';

const session = {
  userId: 'user-1',
  provider: 'email' as const,
};

const task = {
  id: 'task-1',
  title: 'Task',
  description: '',
  status: 'todo' as const,
  priority: 'medium' as const,
  dueDate: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: session.userId,
  demoData: false,
};

const project = {
  id: 'project-1',
  title: 'Project',
  description: '',
  status: 'active' as const,
  progress: 0,
  startDate: '',
  endDate: '',
  teamMembers: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: session.userId,
  demoData: false,
};

const setOnline = (online: boolean) => {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    configurable: true,
    value: online,
  });
};

const installWindowStub = () => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
};

describe('storage transaction and offline queue integration', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    installWindowStub();
    setOnline(false);
    syncService._isSyncing = false;
    syncService.transport = {
      send: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(async () => {
    syncService._isSyncing = false;
    await db.delete();
  });

  it('rolls back a multi-table transaction when a later write fails', async () => {
    await db.runTransaction('readwrite', ['projects', 'tasks'], async () => {
      await db.projects.add(project);
      await db.tasks.add({ ...task, projectId: project.id });
    });

    await expect(
      db.runTransaction('readwrite', ['projects', 'tasks'], async () => {
        await db.projects.put({ ...project, progress: 50 });
        await db.tasks.put({ ...task, status: 'done', projectId: project.id });
        throw new Error('forced transaction failure');
      })
    ).rejects.toThrow('forced transaction failure');

    await expect(db.projects.get(project.id)).resolves.toEqual(project);
    await expect(db.tasks.get(task.id)).resolves.toEqual({
      ...task,
      projectId: project.id,
    });
  });

  it('persists offline operations without attempting network synchronization', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    syncService.transport = { send };

    await syncService.addToSyncQueue('update', 'task', {
      ...task,
      status: 'inProgress',
    });

    const queue = await syncService.getSyncQueue();

    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      operation: 'update',
      entity: 'task',
      retryCount: 0,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('flushes the offline queue after the connection is restored', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    syncService.transport = { send };

    await syncService.addToSyncQueue('update', 'task', task);
    await syncService.addToSyncQueue('create', 'project', project);

    setOnline(true);
    const result = await syncService.synchronize();

    expect(send).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      success: true,
      processed: 2,
      failed: 0,
      totalItems: 2,
    });
    await expect(syncService.getSyncQueue()).resolves.toHaveLength(0);
  });

  it('discards terminal transport errors without retrying them', async () => {
    syncService.transport = {
      send: vi.fn().mockRejectedValue(
        new SyncTransportError('Validation failed', false, 422, true)
      ),
    };

    await syncService.addToSyncQueue('update', 'task', task);
    setOnline(true);

    const result = await syncService.synchronize();

    expect(result).toMatchObject({
      success: true,
      processed: 1,
      failed: 0,
      totalItems: 1,
    });
    await expect(syncService.getSyncQueue()).resolves.toHaveLength(0);
  });

  it('keeps retryable failures in the queue and increments retryCount', async () => {
    syncService.transport = {
      send: vi.fn().mockRejectedValue(
        new SyncTransportError('Temporary outage', true, 503, false)
      ),
    };

    await syncService.addToSyncQueue('update', 'task', task);
    setOnline(true);

    const result = await syncService.synchronize();
    const queue = await syncService.getSyncQueue();

    expect(result).toMatchObject({
      success: false,
      processed: 0,
      failed: 1,
      totalItems: 1,
    });
    expect(queue[0]).toMatchObject({
      retryCount: 1,
      error: 'Не удалось синхронизировать',
    });
  });
});
