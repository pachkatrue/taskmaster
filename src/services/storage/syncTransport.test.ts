import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSyncTransport,
  SyncTransportError,
} from './syncTransport';
import type { SyncQueueItem } from './syncService';

const item: SyncQueueItem = {
  id: 'task_task-1',
  operation: 'update',
  entity: 'task',
  data: { id: 'task-1' },
  timestamp: 1,
  retryCount: 0,
};

describe('sync transport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends queued operations to the configured API', async () => {
    vi.stubEnv('VITE_SYNC_API_URL', 'https://api.example.com/');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await createSyncTransport().send(item);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/sync',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      })
    );
  });

  it('marks validation errors as non-retryable and discardable', async () => {
    vi.stubEnv('VITE_SYNC_API_URL', 'https://api.example.com');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 422 })));

    await expect(createSyncTransport().send(item)).rejects.toMatchObject({
      retryable: false,
      discard: true,
      status: 422,
    });
  });

  it('keeps an unconfigured transport explicit instead of simulating success', async () => {
    const transport = createSyncTransport();

    await expect(transport.send(item)).rejects.toMatchObject({
      retryable: false,
      discard: false,
    });
  });
});
