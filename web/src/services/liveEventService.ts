/**
 * LiveEventService — Клиентский сервис реального времени на базе нативного EventSource.
 *
 * Особенности:
 * - Подключение к SSE стриму /api/events без сторонних зависимостей (Native EventSource).
 * - Автоматический реконнект с экспоненциальной задержкой (Exponential Backoff).
 * - Типизированные события: scan:started, scan:progress, scan:completed, snapshot:updated.
 * - Уведомление об изменении статуса соединения (connecting, connected, reconnecting, disconnected).
 */

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface ScanProgressData {
  source: string;
  count: number;
  pct: number;
}

export interface ScanStartedData {
  timestamp: string;
}

export interface ScanCompletedData {
  snapshotId: string;
  totalGames: number;
  timestamp?: string;
}

export interface SnapshotUpdatedData {
  snapshotId: string;
}

export interface LiveEventMap {
  'connected': { clientId?: string };
  'scan:started': ScanStartedData;
  'scan:progress': ScanProgressData;
  'scan:completed': ScanCompletedData;
  'snapshot:updated': SnapshotUpdatedData;
}

export type LiveEventType = keyof LiveEventMap;

export interface LiveEventServiceOptions {
  url?: string;
  autoConnect?: boolean;
  initialRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  backoffMultiplier?: number;
}

/**
 * Преобразует технический идентификатор витрины в понятное русское описание.
 */
export function formatSourceLabel(source: string): string {
  switch (source) {
    case 'roblox':
      return 'Парсинг Roblox...';
    case 'yandex_games':
    case 'yandex':
      return 'Парсинг Яндекс Игр...';
    case 'poki':
      return 'Парсинг Poki...';
    case 'youtube_shorts':
    case 'youtube':
      return 'Анализ YouTube Shorts...';
    default:
      return `Парсинг ${source}...`;
  }
}

export class LiveEventService {
  private readonly url: string;
  private readonly initialRetryDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly backoffMultiplier: number;

  private eventSource: EventSource | null = null;
  private status: ConnectionStatus = 'disconnected';
  private retryAttempt: number = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private isExplicitlyDisconnected: boolean = false;

  private eventListeners: Map<string, Set<(data: any) => void>> = new Map();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();

  constructor(options: LiveEventServiceOptions = {}) {
    this.url = options.url ?? '/api/events';
    this.initialRetryDelayMs = options.initialRetryDelayMs ?? 1000;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? 30000;
    this.backoffMultiplier = options.backoffMultiplier ?? 2;

    if (options.autoConnect !== false) {
      this.connect();
    }
  }

  /**
   * Подключается к SSE потоку на бэкенде.
   */
  public connect(): void {
    if (typeof EventSource === 'undefined') {
      console.warn('[LiveEventService] EventSource не поддерживается в текущем окружении.');
      return;
    }

    if (this.eventSource || this.status === 'connected') {
      return;
    }

    this.isExplicitlyDisconnected = false;
    this.setStatus('connecting');

    try {
      this.eventSource = new EventSource(this.url);
      this.attachEventSourceHandlers(this.eventSource);
    } catch (err) {
      console.error('[LiveEventService] Ошибка создания EventSource:', err);
      this.handleConnectionError();
    }
  }

  /**
   * Корректно завершает текущее соединение и отменяет запланированные реконнекты.
   */
  public disconnect(): void {
    this.isExplicitlyDisconnected = true;
    this.clearRetryTimer();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.retryAttempt = 0;
    this.setStatus('disconnected');
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public isConnected(): boolean {
    return this.status === 'connected';
  }

  public getRetryAttempt(): number {
    return this.retryAttempt;
  }

  /**
   * Подписка на изменение статуса соединения (connecting, connected, reconnecting, disconnected).
   */
  public onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  /**
   * Подписка на конкретное событие сервера (scan:progress, scan:completed и др.).
   */
  public on<E extends LiveEventType>(event: E, handler: (data: LiveEventMap[E]) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    const handlers = this.eventListeners.get(event)!;
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
    };
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      for (const listener of this.statusListeners) {
        try {
          listener(newStatus);
        } catch (e) {
          console.error('[LiveEventService] Ошибка в statusListener:', e);
        }
      }
    }
  }

  private attachEventSourceHandlers(es: EventSource): void {
    es.onopen = () => {
      this.retryAttempt = 0;
      this.setStatus('connected');
    };

    es.onerror = () => {
      this.handleConnectionError();
    };

    // Регистрируем обработчики для известных событий
    const knownEvents: (keyof LiveEventMap | 'collector:progress')[] = [
      'connected',
      'scan:started',
      'scan:progress',
      'collector:progress',
      'scan:completed',
      'snapshot:updated',
    ];

    for (const evName of knownEvents) {
      es.addEventListener(evName, (e: any) => {
        let payload: any = e.data;
        if (typeof e.data === 'string') {
          try {
            payload = JSON.parse(e.data);
          } catch {
            payload = e.data;
          }
        }

        // Если пришло collector:progress, также диспатчим его подписчикам scan:progress
        if (evName === 'collector:progress') {
          this.dispatch('scan:progress', payload);
        }
        this.dispatch(evName as LiveEventType, payload);
      });
    }
  }

  private dispatch(event: LiveEventType, data: any): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[LiveEventService] Ошибка в обработчике события ${event}:`, err);
        }
      }
    }
  }

  private handleConnectionError(): void {
    if (this.isExplicitlyDisconnected) {
      return;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.setStatus('reconnecting');
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.clearRetryTimer();

    // Экспоненциальная задержка: min(maxDelay, initialDelay * backoff^attempt)
    const delay = Math.min(
      this.maxRetryDelayMs,
      Math.round(this.initialRetryDelayMs * Math.pow(this.backoffMultiplier, this.retryAttempt))
    );

    this.retryAttempt++;

    this.retryTimer = setTimeout(() => {
      if (!this.isExplicitlyDisconnected) {
        this.connect();
      }
    }, delay);
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }
}

// Экспортируем синглтон для удобного использования в приложении
export const liveEventService = new LiveEventService({
  url: '/api/events',
  autoConnect: false, // Инициализируется явно в main.ts
});
