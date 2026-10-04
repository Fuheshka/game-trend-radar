import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MarketScanner, runMarketScan, CollectorProgressEvent, ScanStartedEvent, ScanCompletedEvent } from '../src/scanner.js';
import { MarketEventBus } from '../src/events/event_bus.js';
import { SnapshotStore } from '../src/storage/snapshot_store.js';
import { NormalizedGame, PlatformType } from '../src/types/index.js';

describe('MarketScanner Events Integration (TDD)', () => {
  const testDir = path.join(process.cwd(), 'data', 'test-scanner-events');
  let store: SnapshotStore;

  function createMockGames(count: number, platform: PlatformType): NormalizedGame[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `${platform}-${i}`,
      platform,
      title: `Test ${platform} Game ${i}`,
      genre: 'Simulation',
      archetype: 'SIMULATION_INCREMENTAL' as const,
      metricValue: 1000 + i,
      metricType: platform === 'roblox' ? 'ccu' as const : 'rating' as const,
      tags: ['test'],
      timestamp: new Date().toISOString(),
    }));
  }

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    store = new SnapshotStore(testDir);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('1. Трансляция последовательности событий через MarketEventBus', () => {
    it('должен отправлять точную последовательность событий в процессе сканирования', async () => {
      const eventBus = new MarketEventBus();
      const eventsSequence: { event: string; data: any }[] = [];

      eventBus.on('broadcast', (payload) => {
        eventsSequence.push(payload);
      });

      // Моки коллекторов с точным количеством из критериев приемки:
      // roblox: 120 (pct: 25)
      // yandex_games: 120 -> кумулятивно 240 (pct: 55)
      // poki: 70 -> кумулятивно 310 (pct: 75)
      // youtube_shorts: 163 -> кумулятивно 473 (pct: 90)
      const scanner = new MarketScanner({
        store,
        silent: true,
        eventBus,
        robloxCollector: {
          fetchAllKeySorts: async () => createMockGames(120, 'roblox'),
        },
        yandexCollector: {
          fetchCatalog: async () => createMockGames(120, 'yandex_games'),
        },
        pokiCollector: {
          fetchPopular: async () => createMockGames(70, 'poki'),
        },
        youtubeAnalyzer: {
          getViralShortsTrends: async () => createMockGames(163, 'youtube_trends'),
          scanTrendingSlices: async () => [],
          detectViralMemes: () => [],
          calculateViralMultiplier: () => 1.0,
        },
      });

      const snapshot = await scanner.scan();

      expect(snapshot).toBeDefined();
      expect(snapshot.totalGamesScanned).toBe(473);

      // Проверяем события
      expect(eventsSequence.length).toBeGreaterThanOrEqual(6);

      // 1. scan:started
      expect(eventsSequence[0].event).toBe('scan:started');
      expect(eventsSequence[0].data.timestamp).toBeDefined();

      // 2. collector:progress (roblox)
      expect(eventsSequence[1].event).toBe('collector:progress');
      expect(eventsSequence[1].data).toEqual({
        source: 'roblox',
        count: 120,
        pct: 25,
      });

      // 3. collector:progress (yandex_games)
      expect(eventsSequence[2].event).toBe('collector:progress');
      expect(eventsSequence[2].data).toEqual({
        source: 'yandex_games',
        count: 240,
        pct: 55,
      });

      // 4. collector:progress (poki)
      expect(eventsSequence[3].event).toBe('collector:progress');
      expect(eventsSequence[3].data).toEqual({
        source: 'poki',
        count: 310,
        pct: 75,
      });

      // 5. collector:progress (youtube_shorts)
      expect(eventsSequence[4].event).toBe('collector:progress');
      expect(eventsSequence[4].data).toEqual({
        source: 'youtube_shorts',
        count: 473,
        pct: 90,
      });

      // 6. scan:completed
      const completedEvent = eventsSequence.find(e => e.event === 'scan:completed');
      expect(completedEvent).toBeDefined();
      expect(completedEvent!.data.totalGames).toBe(473);
      expect(completedEvent!.data.snapshotId).toBe(snapshot.id);
    });

    it('должен поддерживать подписку на именованные события eventBus (eventBus.on("collector:progress"))', async () => {
      const eventBus = new MarketEventBus();
      const progressList: CollectorProgressEvent[] = [];
      let startedPayload: ScanStartedEvent | null = null;
      let completedPayload: ScanCompletedEvent | null = null;

      eventBus.on('scan:started', (data) => {
        startedPayload = data;
      });

      eventBus.on('collector:progress', (data) => {
        progressList.push(data);
      });

      eventBus.on('scan:completed', (data) => {
        completedPayload = data;
      });

      const scanner = new MarketScanner({
        store,
        silent: true,
        eventBus,
        robloxCollector: {
          fetchAllKeySorts: async () => createMockGames(50, 'roblox'),
        },
        yandexCollector: {
          fetchCatalog: async () => createMockGames(50, 'yandex_games'),
        },
        pokiCollector: {
          fetchPopular: async () => createMockGames(20, 'poki'),
        },
        youtubeAnalyzer: {
          getViralShortsTrends: async () => createMockGames(30, 'youtube_trends'),
          scanTrendingSlices: async () => [],
          detectViralMemes: () => [],
          calculateViralMultiplier: () => 1.0,
        },
      });

      await scanner.scan();

      expect(startedPayload).not.toBeNull();
      expect(startedPayload!.timestamp).toBeDefined();

      expect(progressList).toEqual([
        { source: 'roblox', count: 50, pct: 25 },
        { source: 'yandex_games', count: 100, pct: 55 },
        { source: 'poki', count: 120, pct: 75 },
        { source: 'youtube_shorts', count: 150, pct: 90 },
      ]);

      expect(completedPayload).not.toBeNull();
      expect(completedPayload!.totalGames).toBe(150);
    });
  });

  describe('2. Работа с коллбэком onProgress', () => {
    it('должен транслировать прогресс в пользовательский коллбэк onProgress', async () => {
      const progressLogs: CollectorProgressEvent[] = [];

      const scanner = new MarketScanner({
        store,
        silent: true,
        onProgress: (p) => progressLogs.push(p),
        robloxCollector: {
          fetchAllKeySorts: async () => createMockGames(10, 'roblox'),
        },
        yandexCollector: {
          fetchCatalog: async () => createMockGames(20, 'yandex_games'),
        },
        pokiCollector: {
          fetchPopular: async () => createMockGames(30, 'poki'),
        },
        youtubeAnalyzer: {
          getViralShortsTrends: async () => createMockGames(40, 'youtube_trends'),
          scanTrendingSlices: async () => [],
          detectViralMemes: () => [],
          calculateViralMultiplier: () => 1.0,
        },
      });

      await scanner.scan();

      expect(progressLogs).toHaveLength(4);
      expect(progressLogs[0]).toEqual({ source: 'roblox', count: 10, pct: 25 });
      expect(progressLogs[1]).toEqual({ source: 'yandex_games', count: 30, pct: 55 });
      expect(progressLogs[2]).toEqual({ source: 'poki', count: 60, pct: 75 });
      expect(progressLogs[3]).toEqual({ source: 'youtube_shorts', count: 100, pct: 90 });
    });

    it('должен позволять передачу onProgress вторым аргументом конструктора', async () => {
      const progressLogs: CollectorProgressEvent[] = [];
      const eventBus = new MarketEventBus();

      const scanner = new MarketScanner(
        {
          store,
          silent: true,
          eventBus,
          robloxCollector: {
            fetchAllKeySorts: async () => createMockGames(5, 'roblox'),
          },
          yandexCollector: {
            fetchCatalog: async () => createMockGames(5, 'yandex_games'),
          },
          pokiCollector: {
            fetchPopular: async () => createMockGames(5, 'poki'),
          },
          youtubeAnalyzer: {
            getViralShortsTrends: async () => createMockGames(5, 'youtube_trends'),
            scanTrendingSlices: async () => [],
            detectViralMemes: () => [],
            calculateViralMultiplier: () => 1.0,
          },
        },
        (p) => progressLogs.push(p)
      );

      await scanner.scan();

      expect(progressLogs).toHaveLength(4);
      expect(progressLogs[3]).toEqual({ source: 'youtube_shorts', count: 20, pct: 90 });
    });

    it('должен позволять передачу eventBus напрямую первым аргументом конструктора', async () => {
      const eventBus = new MarketEventBus();
      const events: string[] = [];
      eventBus.on('scan:started', () => events.push('started'));
      eventBus.on('scan:completed', () => events.push('completed'));

      const scanner = new MarketScanner(eventBus);
      // Проверяем инициализацию без вызова полного реального парсинга
      expect(scanner).toBeInstanceOf(MarketScanner);
    });
  });

  describe('3. Функция runMarketScan с опциями eventBus и onProgress', () => {
    it('должна поддерживать eventBus и onProgress через options в runMarketScan', async () => {
      const eventBus = new MarketEventBus();
      const progressEvents: CollectorProgressEvent[] = [];
      let completedCalled = false;

      eventBus.on('scan:completed', () => {
        completedCalled = true;
      });

      const snapshot = await runMarketScan({
        store,
        silent: true,
        eventBus,
        onProgress: (p) => progressEvents.push(p),
        robloxCollector: {
          fetchAllKeySorts: async () => createMockGames(10, 'roblox'),
        },
        yandexCollector: {
          fetchCatalog: async () => createMockGames(10, 'yandex_games'),
        },
        pokiCollector: {
          fetchPopular: async () => createMockGames(10, 'poki'),
        },
        youtubeAnalyzer: {
          getViralShortsTrends: async () => createMockGames(10, 'youtube_trends'),
          scanTrendingSlices: async () => [],
          detectViralMemes: () => [],
          calculateViralMultiplier: () => 1.0,
        },
      });

      expect(snapshot).toBeDefined();
      expect(progressEvents).toHaveLength(4);
      expect(completedCalled).toBe(true);
    });
  });

  describe('4. Прямая подписка на события инстанса MarketScanner', () => {
    it('должен эмитить события напрямую через EventEmitter инстанса сканера', async () => {
      const directEvents: { event: string; data: any }[] = [];

      const scanner = new MarketScanner({
        store,
        silent: true,
        snapshotId: 'snapshot-2026-10-04',
        robloxCollector: {
          fetchAllKeySorts: async () => createMockGames(15, 'roblox'),
        },
        yandexCollector: {
          fetchCatalog: async () => createMockGames(25, 'yandex_games'),
        },
        pokiCollector: {
          fetchPopular: async () => createMockGames(35, 'poki'),
        },
        youtubeAnalyzer: {
          getViralShortsTrends: async () => createMockGames(45, 'youtube_trends'),
          scanTrendingSlices: async () => [],
          detectViralMemes: () => [],
          calculateViralMultiplier: () => 1.0,
        },
      });

      scanner.on('scan:started', (d) => directEvents.push({ event: 'scan:started', data: d }));
      scanner.on('collector:progress', (d) => directEvents.push({ event: 'collector:progress', data: d }));
      scanner.on('scan:completed', (d) => directEvents.push({ event: 'scan:completed', data: d }));

      const snapshot = await scanner.scan();

      expect(snapshot.id).toBe('snapshot-2026-10-04');
      expect(directEvents[0].event).toBe('scan:started');
      expect(directEvents[1].data).toEqual({ source: 'roblox', count: 15, pct: 25 });
      expect(directEvents[2].data).toEqual({ source: 'yandex_games', count: 40, pct: 55 });
      expect(directEvents[3].data).toEqual({ source: 'poki', count: 75, pct: 75 });
      expect(directEvents[4].data).toEqual({ source: 'youtube_shorts', count: 120, pct: 90 });
      expect(directEvents[5].data).toEqual({
        snapshotId: 'snapshot-2026-10-04',
        totalGames: 120,
        timestamp: snapshot.timestamp,
      });
    });

    it('должен позволять передачу единственного коллбэка onProgress в конструктор', async () => {
      const logs: CollectorProgressEvent[] = [];
      const scanner = new MarketScanner((p) => logs.push(p));
      expect(scanner).toBeInstanceOf(MarketScanner);
    });
  });
});

