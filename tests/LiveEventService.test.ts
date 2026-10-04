import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  LiveEventService,
  ConnectionStatus,
  ScanProgressData,
  ScanCompletedData,
  ScanStartedData,
  formatSourceLabel,
} from '../web/src/services/liveEventService.js';

// Mock EventSource implementation for Node/Vitest
class MockEventSource {
  public static instances: MockEventSource[] = [];
  public url: string;
  public readyState: number = 0; // 0: CONNECTING, 1: OPEN, 2: CLOSED
  public onopen: ((e: any) => void) | null = null;
  public onerror: ((e: any) => void) | null = null;
  public onmessage: ((e: any) => void) | null = null;
  private listeners: Record<string, ((e: any) => void)[]> = {};

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  public addEventListener(event: string, handler: (e: any) => void): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  public removeEventListener(event: string, handler: (e: any) => void): void {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(h => h !== handler);
    }
  }

  public simulateOpen(): void {
    this.readyState = 1;
    if (this.onopen) this.onopen({ type: 'open' });
  }

  public simulateError(error: any = { type: 'error' }): void {
    this.readyState = 2;
    if (this.onerror) this.onerror(error);
  }

  public simulateEvent(eventName: string, data: any): void {
    const rawData = typeof data === 'string' ? data : JSON.stringify(data);
    const eventObj = { type: eventName, data: rawData };
    if (this.listeners[eventName]) {
      this.listeners[eventName].forEach(h => h(eventObj));
    }
    if (eventName === 'message' && this.onmessage) {
      this.onmessage(eventObj);
    }
  }

  public close(): void {
    this.readyState = 2;
  }
}

describe('LiveEventService & SSE Client (TDD)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    (globalThis as any).EventSource = MockEventSource;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    delete (globalThis as any).EventSource;
  });

  describe('1. Инициализация и подключение', () => {
    it('должен создавать подключение EventSource к указанному URL', () => {
      const service = new LiveEventService({ url: '/api/events', autoConnect: false });
      expect(service.getStatus()).toBe('disconnected');
      expect(service.isConnected()).toBe(false);

      service.connect();

      expect(MockEventSource.instances.length).toBe(1);
      expect(MockEventSource.instances[0].url).toBe('/api/events');
      expect(service.getStatus()).toBe('connecting');

      // Имитируем успешное открытие
      MockEventSource.instances[0].simulateOpen();
      expect(service.getStatus()).toBe('connected');
      expect(service.isConnected()).toBe(true);

      service.disconnect();
    });

    it('должен транслировать смену статуса через подписчик onStatusChange', () => {
      const service = new LiveEventService({ url: '/api/events', autoConnect: false });
      const statuses: ConnectionStatus[] = [];

      service.onStatusChange(s => statuses.push(s));

      service.connect();
      expect(statuses).toEqual(['connecting']);

      MockEventSource.instances[0].simulateOpen();
      expect(statuses).toEqual(['connecting', 'connected']);

      service.disconnect();
      expect(statuses).toEqual(['connecting', 'connected', 'disconnected']);
    });
  });

  describe('2. Экспоненциальный реконнект (Exponential Backoff)', () => {
    it('должен автоматически переподключаться при обрыве связи с экспоненциальной задержкой', () => {
      const service = new LiveEventService({
        url: '/api/events',
        autoConnect: false,
        initialRetryDelayMs: 1000,
        maxRetryDelayMs: 16000,
        backoffMultiplier: 2,
      });

      service.connect();
      const firstSource = MockEventSource.instances[0];
      firstSource.simulateOpen();
      expect(service.getStatus()).toBe('connected');

      // 1-й сбой: задержка 1000мс
      firstSource.simulateError();
      expect(service.getStatus()).toBe('reconnecting');
      expect(MockEventSource.instances.length).toBe(1);

      // Проматываем меньше таймера — нового инстанса еще нет
      vi.advanceTimersByTime(900);
      expect(MockEventSource.instances.length).toBe(1);

      // Доходим до 1000мс — создан 2-й инстанс
      vi.advanceTimersByTime(100);
      expect(MockEventSource.instances.length).toBe(2);

      // 2-й сбой: задержка 2000мс
      const secondSource = MockEventSource.instances[1];
      secondSource.simulateError();
      expect(service.getStatus()).toBe('reconnecting');

      vi.advanceTimersByTime(1900);
      expect(MockEventSource.instances.length).toBe(2);

      vi.advanceTimersByTime(100);
      expect(MockEventSource.instances.length).toBe(3);

      // 3-й сбой: задержка 4000мс
      const thirdSource = MockEventSource.instances[2];
      thirdSource.simulateError();

      vi.advanceTimersByTime(4000);
      expect(MockEventSource.instances.length).toBe(4);

      // Успешный коннект на 4-й раз сбрасывает счетчик попыток
      MockEventSource.instances[3].simulateOpen();
      expect(service.getStatus()).toBe('connected');
      expect(service.getRetryAttempt()).toBe(0);

      service.disconnect();
    });

    it('не должен превышать maxRetryDelayMs при череде сбоев', () => {
      const service = new LiveEventService({
        url: '/api/events',
        autoConnect: false,
        initialRetryDelayMs: 1000,
        maxRetryDelayMs: 3000,
        backoffMultiplier: 2,
      });

      service.connect();
      MockEventSource.instances[0].simulateOpen();

      // Attempt 1 -> 1000ms
      MockEventSource.instances[0].simulateError();
      vi.advanceTimersByTime(1000);

      // Attempt 2 -> 2000ms
      MockEventSource.instances[1].simulateError();
      vi.advanceTimersByTime(2000);

      // Attempt 3 -> 4000ms capped at 3000ms
      MockEventSource.instances[2].simulateError();
      vi.advanceTimersByTime(2900);
      expect(MockEventSource.instances.length).toBe(3);
      vi.advanceTimersByTime(100);
      expect(MockEventSource.instances.length).toBe(4);

      service.disconnect();
    });

    it('не должен переподключаться после явного вызова disconnect()', () => {
      const service = new LiveEventService({ url: '/api/events', autoConnect: false });
      service.connect();
      MockEventSource.instances[0].simulateOpen();

      service.disconnect();
      expect(service.getStatus()).toBe('disconnected');

      vi.advanceTimersByTime(60000);
      expect(MockEventSource.instances.length).toBe(1);
    });
  });

  describe('3. Обработка событий сканирования', () => {
    it('должен корректно принимать и парсить событие scan:progress', () => {
      const service = new LiveEventService({ url: '/api/events', autoConnect: false });
      service.connect();
      MockEventSource.instances[0].simulateOpen();

      const receivedProgress: ScanProgressData[] = [];
      const unsub = service.on('scan:progress', (data: ScanProgressData) => {
        receivedProgress.push(data);
      });

      MockEventSource.instances[0].simulateEvent('scan:progress', {
        source: 'yandex_games',
        count: 240,
        pct: 55,
      });

      expect(receivedProgress).toEqual([
        { source: 'yandex_games', count: 240, pct: 55 },
      ]);

      unsub();
      MockEventSource.instances[0].simulateEvent('scan:progress', {
        source: 'poki',
        count: 310,
        pct: 75,
      });
      // После отписки новых событий не должно быть
      expect(receivedProgress.length).toBe(1);

      service.disconnect();
    });

    it('должен принимать collector:progress как алиас для scan:progress', () => {
      const service = new LiveEventService({ url: '/api/events', autoConnect: false });
      service.connect();
      MockEventSource.instances[0].simulateOpen();

      const received: ScanProgressData[] = [];
      service.on('scan:progress', (data: ScanProgressData) => {
        received.push(data);
      });

      MockEventSource.instances[0].simulateEvent('collector:progress', {
        source: 'roblox',
        count: 120,
        pct: 25,
      });

      expect(received).toEqual([
        { source: 'roblox', count: 120, pct: 25 },
      ]);

      service.disconnect();
    });

    it('должен принимать событие scan:completed', () => {
      const service = new LiveEventService({ url: '/api/events', autoConnect: false });
      service.connect();
      MockEventSource.instances[0].simulateOpen();

      let completedPayload: ScanCompletedData | null = null;
      service.on('scan:completed', (data: ScanCompletedData) => {
        completedPayload = data;
      });

      MockEventSource.instances[0].simulateEvent('scan:completed', {
        snapshotId: 'snapshot-2026-10-04',
        totalGames: 473,
      });

      expect(completedPayload).toEqual({
        snapshotId: 'snapshot-2026-10-04',
        totalGames: 473,
      });

      service.disconnect();
    });

    it('должен принимать событие snapshot:updated', () => {
      const service = new LiveEventService({ url: '/api/events', autoConnect: false });
      service.connect();
      MockEventSource.instances[0].simulateOpen();

      let updatedId: string | null = null;
      service.on('snapshot:updated', (data: { snapshotId: string }) => {
        updatedId = data.snapshotId;
      });

      MockEventSource.instances[0].simulateEvent('snapshot:updated', {
        snapshotId: 'snapshot-2026-10-04',
      });

      expect(updatedId).toBe('snapshot-2026-10-04');

      service.disconnect();
    });

    it('должен принимать событие scan:started', () => {
      const service = new LiveEventService({ url: '/api/events', autoConnect: false });
      service.connect();
      MockEventSource.instances[0].simulateOpen();

      let startedPayload: ScanStartedData | null = null;
      service.on('scan:started', (data: ScanStartedData) => {
        startedPayload = data;
      });

      MockEventSource.instances[0].simulateEvent('scan:started', {
        timestamp: '2026-10-04T12:00:00Z',
      });

      expect(startedPayload).toEqual({
        timestamp: '2026-10-04T12:00:00Z',
      });

      service.disconnect();
    });
  });

  describe('4. formatSourceLabel хелпер', () => {
    it('должен возвращать понятные русские названия витрин', () => {
      expect(formatSourceLabel('roblox')).toBe('Парсинг Roblox...');
      expect(formatSourceLabel('yandex_games')).toBe('Парсинг Яндекс Игр...');
      expect(formatSourceLabel('yandex')).toBe('Парсинг Яндекс Игр...');
      expect(formatSourceLabel('poki')).toBe('Парсинг Poki...');
      expect(formatSourceLabel('youtube_shorts')).toBe('Анализ YouTube Shorts...');
      expect(formatSourceLabel('youtube')).toBe('Анализ YouTube Shorts...');
      expect(formatSourceLabel('custom_platform')).toBe('Парсинг custom_platform...');
    });
  });
});
