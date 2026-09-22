import { db, handleDexieError } from './db';
import { createSyncTransport, SyncTransportError, type SyncTransport } from './syncTransport';

declare global {
  interface ServiceWorkerRegistration {
    sync?: {
      register: (tag: string) => Promise<void>;
    };
  }

  // Добавляем типы для кастомных событий
  interface WindowEventMap {
    'syncStarted': CustomEvent;
    'syncCompleted': CustomEvent<{success: boolean}>;
    'syncError': CustomEvent<{message: string}>;
    'syncProgress': CustomEvent<{current: number, total: number}>;
    'connectionChange': CustomEvent<{online: boolean}>;
  }
}

/**
 * Тип для операций синхронизации
 */
export type SyncOperation = 'create' | 'update' | 'delete';

/**
 * Тип для сущностей синхронизации
 */
export type SyncEntity = 'task' | 'project' | 'user' | 'settings';

/**
 * Интерфейс для элемента очереди синхронизации
 */
export interface SyncQueueItem {
  id: string;
  operation: SyncOperation;
  entity: SyncEntity;
  data: unknown;
  timestamp: number;
  retryCount: number;
  error?: string;
  priority?: number; // Приоритет операции (чем выше, тем важнее)
  lastRetryTimestamp?: number; // Время последней попытки
}

/**
 * Интерфейс для результата синхронизации
 */
export interface SyncResult {
  success: boolean;
  processed: number;
  failed: number;
  totalItems: number;
  errors?: string[];
}

/**
 * Расширенный сервис для синхронизации с сервером
 * В режиме оффлайн все операции сохраняются в очередь
 * При восстановлении соединения выполняется синхронизация
 */
export const syncService = {
  /**
   * Максимальное количество попыток синхронизации
   */
  MAX_RETRY_COUNT: 3,

  /**
   * Задержка между попытками синхронизации (в миллисекундах)
   */
  RETRY_DELAY: 5000,

  /**
   * Интервал проверки синхронизации (в миллисекундах)
   */
  SYNC_CHECK_INTERVAL: 60000, // 1 минута

  /**
   * Флаг, указывающий на то, что синхронизация в процессе
   */
  _isSyncing: false,

  /**
   * ID интервала для периодической синхронизации
   */
  _syncIntervalId: null as ReturnType<typeof setInterval> | null,

  _boundOnlineHandler: () => this._handleOnline(),
  _boundOfflineHandler: () => this._handleOffline(),

  transport: createSyncTransport() as SyncTransport,

  /**
   * Инициализация сервиса синхронизации
   */
  init(): void {
    // Добавляем слушатели событий изменения состояния сети
    window.addEventListener('online', this._boundOnlineHandler);
    window.addEventListener('offline', this._boundOfflineHandler);

    // Проверяем состояние сети при запуске
    if (this.isOnline()) {
      this._emitConnectionChangeEvent(true);
    } else {
      this._emitConnectionChangeEvent(false);
    }

    // Регистрируем background sync, если поддерживается
    this.registerBackgroundSync().catch(err => {
      console.warn('Не удалось зарегистрировать background sync:', err);
    });

    // Запускаем периодическую проверку синхронизации
    this.startPeriodicSync();

    console.log('Сервис синхронизации инициализирован');
  },

  /**
   * Остановка сервиса синхронизации
   */
  dispose(): void {
    // Удаляем слушатели событий
    window.removeEventListener('online', this._boundOnlineHandler);
    window.removeEventListener('offline', this._boundOfflineHandler);

    // Останавливаем периодическую синхронизацию
    if (this._syncIntervalId) {
      clearInterval(this._syncIntervalId);
      this._syncIntervalId = null;
    }

    console.log('Сервис синхронизации остановлен');
  },

  /**
   * Обработчик события подключения к сети
   */
  _handleOnline(): void {
    console.log('Соединение восстановлено');
    this._emitConnectionChangeEvent(true);

    // Запускаем синхронизацию при восстановлении соединения
    this.synchronize().catch(error => {
      console.error('Ошибка при автоматической синхронизации:', error);
    });
  },

  /**
   * Обработчик события отключения от сети
   */
  _handleOffline(): void {
    console.log('Соединение потеряно');
    this._emitConnectionChangeEvent(false);
  },

  /**
   * Отправка события изменения подключения
   */
  _emitConnectionChangeEvent(online: boolean): void {
    window.dispatchEvent(
      new CustomEvent('connectionChange', { detail: { online } })
    );
  },

  /**
   * Проверить состояние сети
   */
  isOnline(): boolean {
    return navigator.onLine;
  },

  /**
   * Добавить операцию в очередь синхронизации с улучшенной обработкой ошибок
   */
  async addToSyncQueue(
    operation: SyncOperation,
    entity: SyncEntity,
    data: unknown,
    priority: number = 1
  ): Promise<string> {
    try {
      if (!db.isOpen()) {
        await db.open();
      }
      // Устанавливаем дефолтный ID для элемента очереди
      let id = `${entity}_${Date.now()}_${crypto.randomUUID()}`;

      // Для операций обновления и удаления используем ID объекта
      if (operation === 'update' || operation === 'delete') {
        if (data && typeof data === 'object' && 'id' in data) {
          id = `${entity}_${(data as { id: string }).id}`;
        }
      }

      // Создаем элемент очереди
      const syncItem: SyncQueueItem = {
        id,
        operation,
        entity,
        data,
        timestamp: Date.now(),
        retryCount: 0,
        priority
      };

      // Проверяем, нет ли уже такого элемента в очереди
      const existingItem = await db.syncQueue.get(id);

      if (existingItem) {
        // Если элемент существует и это операция удаления, обновляем его
        if (operation === 'delete') {
          await db.syncQueue.update(id, {
            ...syncItem,
            retryCount: 0 // Сбрасываем счетчик попыток
          });
        }
        // Если это операция обновления, заменяем данные
        else if (operation === 'update') {
          await db.syncQueue.update(id, {
            ...existingItem,
            data,
            timestamp: Date.now(),
            retryCount: 0 // Сбрасываем счетчик попыток
          });
        }
        // В остальных случаях оставляем существующий элемент
      } else {
        // Добавляем новый элемент
        await db.syncQueue.add(syncItem);
      }

      console.log(`Операция ${operation} для ${entity} добавлена в очередь синхронизации`, data);

      // Если онлайн, запускаем синхронизацию
      if (this.isOnline() && !this._isSyncing) {
        // Запускаем синхронизацию с небольшой задержкой,
        // чтобы дать время на добавление нескольких операций подряд
        queueMicrotask(() => void this.synchronize());
      }

      return id;
    } catch (error) {
      handleDexieError(error, 'Ошибка при добавлении в очередь синхронизации');
      throw error;
    }
  },

  /**
   * Получить элементы очереди синхронизации с сортировкой по приоритету
   */
  async getSyncQueue(): Promise<SyncQueueItem[]> {
    try {
      // Получаем все элементы очереди
      const items = await db.syncQueue.toArray();

      // Сортируем элементы: сначала по приоритету (по убыванию), затем по timestamp (по возрастанию)
      return items.sort((a, b) => {
        // Приоритет (чем выше, тем важнее)
        const priorityDiff = (b.priority || 1) - (a.priority || 1);
        if (priorityDiff !== 0) return priorityDiff;

        // Время добавления (сначала старые)
        return a.timestamp - b.timestamp;
      });
    } catch (error) {
      handleDexieError(error, 'Ошибка при получении очереди синхронизации');
      return [];
    }
  },

  /**
   * Удалить элемент из очереди синхронизации
   */
  async removeFromSyncQueue(id: string): Promise<void> {
    try {
      await db.syncQueue.delete(id);
    } catch (error) {
      handleDexieError(error, `Ошибка при удалении элемента очереди с ID ${id}`);
      throw error;
    }
  },

  /**
   * Обработать элемент очереди синхронизации
   * Отправить элемент через настроенный транспорт синхронизации
   */
  async processSyncItem(item: SyncQueueItem): Promise<boolean> {
    try {
      await this.transport.send(item);
      return true;
    } catch (error) {
      console.error('Ошибка при обработке элемента синхронизации:', error);

      if (error instanceof SyncTransportError && !error.retryable) {
        return error.discard;
      }

      if (error instanceof Error &&
          (error.message.includes('unauthorized') || error.message.includes('401'))) {
        window.dispatchEvent(
          new CustomEvent('syncError', {
            detail: { message: 'Требуется повторная авторизация' }
          })
        );
      }

      return false;
    }
  },
  /**
   * Выполнить синхронизацию с сервером с расширенной обработкой ошибок
   * и отчетом о прогрессе
   */
  async synchronize(): Promise<SyncResult> {
    // Проверяем подключение к сети
    if (!this.isOnline()) {
      console.log('Нет подключения к сети. Синхронизация отложена.');
      return {
        success: false,
        processed: 0,
        failed: 0,
        totalItems: 0,
        errors: ['Нет подключения к сети']
      };
    }

    // Предотвращаем параллельные синхронизации
    if (this._isSyncing) {
      console.log('Синхронизация уже выполняется.');
      return {
        success: false,
        processed: 0,
        failed: 0,
        totalItems: 0,
        errors: ['Синхронизация уже выполняется']
      };
    }

    console.log('Начало синхронизации...');
    this._isSyncing = true;

    try {
      // Получаем элементы очереди
      const queue = await this.getSyncQueue();

      if (queue.length === 0) {
        console.log('Очередь синхронизации пуста');
        this._isSyncing = false;
        return {
          success: true,
          processed: 0,
          failed: 0,
          totalItems: 0
        };
      }

      console.log(`Найдено ${queue.length} элементов для синхронизации`);

      // Оповещаем о начале синхронизации
      this.notifySyncStarted();

      // Счетчики для статистики
      let processed = 0;
      let failed = 0;
      const errors: string[] = [];

      // Обрабатываем каждый элемент очереди
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];

        // Отправляем событие прогресса
        this._emitProgressEvent(i, queue.length);

        try {
          // Проверяем, не превышено ли количество попыток
          if (item.retryCount >= this.MAX_RETRY_COUNT) {
            console.warn(`Превышено количество попыток синхронизации для элемента ${item.id}. Пропускаем.`);

            // Добавляем запись об ошибке
            errors.push(`Превышено количество попыток для ${item.entity} (${item.operation})`);

            // Увеличиваем счетчик неудачных синхронизаций
            failed++;

            continue;
          }

          // Обновляем время последней попытки
          await db.syncQueue.update(item.id, {
            lastRetryTimestamp: Date.now()
          });

          // Обрабатываем элемент
          const success = await this.processSyncItem(item);

          if (success) {
            // Если успешно, удаляем из очереди
            await this.removeFromSyncQueue(item.id);
            console.log(`Элемент ${item.id} успешно синхронизирован и удален из очереди`);

            // Увеличиваем счетчик успешных синхронизаций
            processed++;
          } else {
            // Иначе увеличиваем счетчик попыток
            const updatedItem: SyncQueueItem = {
              ...item,
              retryCount: item.retryCount + 1,
              error: 'Не удалось синхронизировать',
              lastRetryTimestamp: Date.now()
            };

            await db.syncQueue.update(item.id, updatedItem);

            console.warn(`Не удалось синхронизировать элемент ${item.id}. Попытка ${updatedItem.retryCount} из ${this.MAX_RETRY_COUNT}`);

            // Добавляем запись об ошибке
            errors.push(`Ошибка синхронизации ${item.entity} (${item.operation})`);

            // Увеличиваем счетчик неудачных синхронизаций
            failed++;
          }
        } catch (error) {
          console.error(`Ошибка при обработке элемента ${item.id}:`, error);

          // Добавляем запись об ошибке
          errors.push(`Непредвиденная ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);

          // Увеличиваем счетчик неудачных синхронизаций
          failed++;

          // Обновляем информацию об ошибке
          const updatedItem = {
            ...item,
            retryCount: item.retryCount + 1,
            error: error instanceof Error ? error.message : 'Неизвестная ошибка',
            lastRetryTimestamp: Date.now()
          };

          await db.syncQueue.update(item.id, updatedItem);
        }

      }

      // Проверяем, остались ли элементы в очереди
      const remainingItems = await this.getSyncQueue();
      const success = failed === 0 && remainingItems.length === 0;

      // Оповещаем о завершении синхронизации
      this.notifySyncCompleted(success);

      // Формируем результат
      const result: SyncResult = {
        success,
        processed,
        failed,
        totalItems: queue.length,
        errors: errors.length > 0 ? errors : undefined
      };

      console.log('Результаты синхронизации:', result);

      this._isSyncing = false;
      return result;
    } catch (error) {
      console.error('Непредвиденная ошибка при синхронизации:', error);

      // Оповещаем о завершении синхронизации с ошибкой
      this.notifySyncCompleted(false);

      this._isSyncing = false;

      return {
        success: false,
        processed: 0,
        failed: 1,
        totalItems: 1,
        errors: [error instanceof Error ? error.message : 'Неизвестная ошибка']
      };
    }
  },

  /**
   * Оповестить о начале синхронизации
   */
  notifySyncStarted(): void {
    // Отправляем сообщение сервис-воркеру
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SYNC_STARTED'
      });
    }

    // Отправляем событие в приложение
    window.dispatchEvent(new CustomEvent('syncStarted'));

    console.log('Синхронизация начата');
  },

  /**
   * Оповестить о завершении синхронизации
   */
  notifySyncCompleted(success: boolean): void {
    // Отправляем сообщение сервис-воркеру
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SYNC_COMPLETED',
        success
      });
    }

    // Отправляем событие в приложение
    window.dispatchEvent(new CustomEvent('syncCompleted', { detail: { success } }));

    console.log(`Синхронизация завершена${success ? ' успешно' : ' с ошибками'}`);
  },

  /**
   * Отправить событие прогресса синхронизации
   */
  _emitProgressEvent(current: number, total: number): void {
    window.dispatchEvent(
      new CustomEvent('syncProgress', { detail: { current, total } })
    );
  },

  /**
   * Получить статистику синхронизации с дополнительной информацией
   */
  async getSyncStats(): Promise<{
    pendingCount: number;
    errorCount: number;
    oldestItemTimestamp: number | null;
    highPriorityCount: number;
    byEntity: Record<SyncEntity, number>;
    byOperation: Record<SyncOperation, number>;
  }> {
    try {
      const queue = await this.getSyncQueue();

      const pendingCount = queue.length;
      const errorCount = queue.filter(item => item.retryCount > 0).length;
      const highPriorityCount = queue.filter(item => (item.priority || 0) > 1).length;

      // Находим самый старый элемент
      let oldestItemTimestamp: number | null = null;
      if (queue.length > 0) {
        oldestItemTimestamp = Math.min(...queue.map(item => item.timestamp));
      }

      // Собираем статистику по типам сущностей
      const byEntity: Record<SyncEntity, number> = {
        task: 0,
        project: 0,
        user: 0,
        settings: 0
      };

      // Собираем статистику по типам операций
      const byOperation: Record<SyncOperation, number> = {
        create: 0,
        update: 0,
        delete: 0
      };

      // Заполняем статистику
      queue.forEach(item => {
        byEntity[item.entity]++;
        byOperation[item.operation]++;
      });

      return {
        pendingCount,
        errorCount,
        oldestItemTimestamp,
        highPriorityCount,
        byEntity,
        byOperation
      };
    } catch (error) {
      console.error('Ошибка при получении статистики синхронизации:', error);
      return {
        pendingCount: 0,
        errorCount: 0,
        oldestItemTimestamp: null,
        highPriorityCount: 0,
        byEntity: { task: 0, project: 0, user: 0, settings: 0 },
        byOperation: { create: 0, update: 0, delete: 0 }
      };
    }
  },

  /**
   * Начать периодическую синхронизацию с конфигурируемыми параметрами
   */
  startPeriodicSync(intervalMinutes: number = 5): NodeJS.Timeout {
    const intervalMs = intervalMinutes * 60 * 1000;

    console.log(`Запуск периодической синхронизации с интервалом ${intervalMinutes} минут`);

    // Остановить предыдущий интервал, если он был запущен
    if (this._syncIntervalId) {
      clearInterval(this._syncIntervalId);
    }

    // Запускаем интервал и возвращаем его идентификатор для возможности остановки
    this._syncIntervalId = setInterval(async () => {
      try {
        // Проверяем наличие элементов в очереди
        const queue = await this.getSyncQueue();

        if (queue.length > 0 && this.isOnline() && !this._isSyncing) {
          console.log(`Запускаем периодическую синхронизацию (${queue.length} элементов в очереди)`);
          this.synchronize().catch(error => {
            console.error('Ошибка при периодической синхронизации:', error);
          });
        }
      } catch (error) {
        console.error('Ошибка при проверке очереди синхронизации:', error);
      }
    }, intervalMs);

    return this._syncIntervalId;
  },

  /**
   * Остановить периодическую синхронизацию
   */
  stopPeriodicSync(): void {
    if (this._syncIntervalId) {
      clearInterval(this._syncIntervalId);
      this._syncIntervalId = null;
      console.log('Периодическая синхронизация остановлена');
    }
  },

  /**
   * Регистрация для background sync API (если поддерживается)
   */
  async registerBackgroundSync(): Promise<boolean> {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration.sync) {
          await registration.sync.register('syncData');
          console.log('Background Sync зарегистрирован');
          return true;
        } else {
          console.warn('SyncManager не поддерживается в этом браузере');
          return false;
        }
      } catch (error) {
        console.error('Не удалось зарегистрировать Background Sync:', error);
        return false;
      }
    } else {
      console.warn('Background Sync не поддерживается в этом браузере');
      return false;
    }
  },

  /**
   * Очистка очереди синхронизации с возможностью выборочной очистки
   */
  async clearSyncQueue(options?: {
    olderThan?: number;
    entities?: SyncEntity[];
    operations?: SyncOperation[];
    onlyFailed?: boolean;
  }): Promise<number> {
    try {
      // Если нет опций, очищаем всю очередь
      if (!options) {
        const count = await db.syncQueue.count();
        await db.syncQueue.clear();
        console.log(`Очередь синхронизации очищена (${count} элементов удалено)`);
        return count;
      }

      // Составляем условие выборки
      let collection = db.syncQueue.toCollection();

      // Фильтрация по времени
      const olderThan = options?.olderThan;

      if (typeof olderThan === 'number') {
        collection = collection.filter(item => item.timestamp < olderThan);
      }

      // Фильтрация по типу сущности
      if (options.entities && options.entities.length > 0) {
        collection = collection.filter(item => options.entities!.includes(item.entity));
      }

      // Фильтрация по типу операции
      if (options.operations && options.operations.length > 0) {
        collection = collection.filter(item => options.operations!.includes(item.operation));
      }

      // Фильтрация по неудачным попыткам
      if (options.onlyFailed) {
        collection = collection.filter(item => item.retryCount > 0);
      }

      // Получаем ID элементов для удаления
      const itemsToDelete = await collection.toArray();
      const ids = itemsToDelete.map(item => item.id);

      if (ids.length === 0) {
        console.log('Нет элементов для удаления');
        return 0;
      }

      // Удаляем выбранные элементы
      await db.syncQueue.bulkDelete(ids);
      console.log(`Удалено ${ids.length} элементов из очереди синхронизации`);

      return ids.length;
    } catch (error) {
      handleDexieError(error, 'Ошибка при очистке очереди синхронизации');
      return 0;
    }
  }
};