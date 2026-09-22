import type { SyncQueueItem } from './syncService';

export interface SyncTransport {
  send(item: SyncQueueItem): Promise<void>;
}

export class SyncTransportError extends Error {
  constructor(
    message: string,
    readonly retryable = true,
    readonly status?: number
  ) {
    super(message);
    this.name = 'SyncTransportError';
  }
}

class HttpSyncTransport implements SyncTransport {
  constructor(private readonly baseUrl: string) {}

  async send(item: SyncQueueItem): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });

    if (response.ok) return;

    const message = `Sync API returned ${response.status}`;

    if (response.status === 400 || response.status === 422) {
      throw new SyncTransportError(message, false, response.status);
    }

    throw new SyncTransportError(message, true, response.status);
  }
}

class UnconfiguredSyncTransport implements SyncTransport {
  async send(): Promise<void> {
    throw new SyncTransportError(
      'Sync API is not configured. Set VITE_SYNC_API_URL to enable remote synchronization.',
      false
    );
  }
}

export const createSyncTransport = (): SyncTransport => {
  const baseUrl = import.meta.env.VITE_SYNC_API_URL?.trim().replace(/\\/$/, '');

  return baseUrl
    ? new HttpSyncTransport(baseUrl)
    : new UnconfiguredSyncTransport();
};
