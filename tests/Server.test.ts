import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRadarServer, openBrowser } from '../src/server.js';
import { SnapshotStore } from '../src/storage/snapshot_store.js';
import { MarketSnapshot, MarketVerdict } from '../src/types/index.js';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

describe('Radar HTTP Server (порт 4200)', () => {
  let tempDir: string;
  let staticDir: string;
  let store: SnapshotStore;
  let serverInstance: ReturnType<typeof createRadarServer>;
  let baseUrl: string;

  const mockVerdict: MarketVerdict = {
    archetype: 'PHYSICS_SANDBOX',
    titleRu: 'Физический сендбокс',
    status: 'GREEN_LIGHT',
    opportunityScore: {
      overallScore: 88,
      demandScore: 92,
      velocityScore: 85,
      monetizationScore: 80,
      saturationIndex: 2.1,
      productionEffort: 2.0,
      viralMultiplier: 1.5,
    },
    totalAudienceCCU: 450000,
    marketSharePercent: 28,
    sampleTitles: ['Melon Playground', 'Ragdoll Chaos'],
    actionRecommendation: 'Делать немедленно: высокий спрос',
    coreLoopBlueprint: 'Спавн -> Эксперимент -> Разрушение',
    monetizationStrategy: 'Rewarded video за редкие предметы',
    avoidPitfalls: 'Плохая оптимизация физики',
    hasArbitrageOpportunity: true,
  };

  const mockSnapshot: MarketSnapshot = {
    id: 'test-snapshot-uuid',
    timestamp: '2026-09-13T12:00:00.000Z',
    totalGamesScanned: 42,
    platformCounts: {
      roblox: 20,
      yandex_games: 15,
      poki: 5,
      youtube_trends: 2,
    },
    robloxTotalCCU: 1200000,
    games: [
      {
        id: 'roblox-1',
        platform: 'roblox',
        title: 'Steal An Egg',
        genre: 'Simulation',
        archetype: 'SIMULATION_INCREMENTAL',
        metricValue: 350000,
        metricType: 'ccu',
        tags: ['viral', 'simulator'],
        timestamp: '2026-09-13T12:00:00.000Z',
      },
    ],
    verdicts: [mockVerdict],
    arbitrageOpportunities: [
      {
        robloxGame: {
          id: 'roblox-1',
          platform: 'roblox',
          title: 'Steal An Egg',
          genre: 'Simulation',
          archetype: 'SIMULATION_INCREMENTAL',
          metricValue: 350000,
          metricType: 'ccu',
          tags: ['viral', 'simulator'],
          timestamp: '2026-09-13T12:00:00.000Z',
        },
        robloxCCU: 350000,
        archetype: 'SIMULATION_INCREMENTAL',
        similarityWithNearestAnalog: 0.1,
        nearestAnalog: null,
        hasDirectAnalog: false,
        nicheKeywords: ['egg', 'steal'],
        nicheDescription: 'Укради яйцо',
        adaptationStrategy: 'Клик-механика на веб',
        suggestedRuTitle: 'Укради Яйцо: Симулятор',
        badge: 'ARBITRAGE OPPORTUNITY',
        organicPotential: 'CRITICAL_FIRST_MOVER',
      },
    ],
  };

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-server-test-'));
    staticDir = path.join(tempDir, 'web');
    fs.mkdirSync(staticDir, { recursive: true });

    // Populate some static files for testing
    fs.writeFileSync(path.join(staticDir, 'index.html'), '<html><body>Radar UI</body></html>', 'utf-8');
    fs.writeFileSync(path.join(staticDir, 'app.js'), 'console.log("radar");', 'utf-8');
    fs.writeFileSync(path.join(staticDir, 'style.css'), 'body { background: black; }', 'utf-8');

    store = new SnapshotStore(tempDir);
    // Start on ephemeral port (0) for test isolation
    serverInstance = createRadarServer({
      port: 0,
      host: '127.0.0.1',
      store,
      staticDir,
      silent: true,
    });

    const port = await serverInstance.start();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await serverInstance.stop();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('1. CORS и Preflight запросы', () => {
    it('должен отвечать 204 No Content на OPTIONS запрос с корректными CORS-заголовками', async () => {
      const res = await fetch(`${baseUrl}/api/verdicts`, {
        method: 'OPTIONS',
      });

      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
      expect(res.headers.get('access-control-allow-methods')).toContain('GET');
      expect(res.headers.get('access-control-allow-methods')).toContain('POST');
      expect(res.headers.get('access-control-allow-headers')).toContain('Content-Type');
    });
  });

  const mockSnapshot2: MarketSnapshot = {
    ...mockSnapshot,
    id: 'test-snapshot-uuid-2',
    timestamp: '2026-09-14T12:00:00.000Z',
    totalGamesScanned: 88,
    robloxTotalCCU: 1500000,
  };

  describe('2. Эндпоинт GET /api/snapshots/latest', () => {
    it('должен возвращать 404, если в хранилище еще нет снимков', async () => {
      const res = await fetch(`${baseUrl}/api/snapshots/latest`);
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it('должен возвращать последний MarketSnapshot после его сохранения', async () => {
      store.saveSnapshot(mockSnapshot);

      const res = await fetch(`${baseUrl}/api/snapshots/latest`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');

      const data = (await res.json()) as MarketSnapshot;
      expect(data.id).toBe(mockSnapshot.id);
      expect(data.totalGamesScanned).toBe(42);
      expect(data.games.length).toBe(1);
      expect(data.verdicts.length).toBe(1);
      expect(data.arbitrageOpportunities?.length).toBe(1);
    });
  });

  describe('2.1. Эндпоинт GET /api/snapshots (список доступных срезов)', () => {
    it('должен возвращать список снимков с датами и количеством игр, отсортированный по убыванию дат', async () => {
      // Сохраняем второй снимок на более позднюю дату
      store.saveSnapshot(mockSnapshot2);

      const res = await fetch(`${baseUrl}/api/snapshots`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');

      const snapshots = (await res.json()) as Array<{
        id: string;
        date: string;
        timestamp: string;
        totalGamesScanned: number;
        robloxTotalCCU?: number;
      }>;

      expect(Array.isArray(snapshots)).toBe(true);
      expect(snapshots.length).toBe(2);

      // Первый должен быть более свежий (2026-09-14)
      expect(snapshots[0].id).toBe('test-snapshot-uuid-2');
      expect(snapshots[0].date).toBe('2026-09-14');
      expect(snapshots[0].totalGamesScanned).toBe(88);
      expect(snapshots[0].robloxTotalCCU).toBe(1500000);

      // Второй должен быть за 2026-09-13
      expect(snapshots[1].id).toBe('test-snapshot-uuid');
      expect(snapshots[1].date).toBe('2026-09-13');
      expect(snapshots[1].totalGamesScanned).toBe(42);
    });
  });

  describe('2.2. Эндпоинт GET /api/snapshots/:id (получение конкретного среза)', () => {
    it('должен находить снимок по id (UUID)', async () => {
      const res = await fetch(`${baseUrl}/api/snapshots/test-snapshot-uuid`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as MarketSnapshot;
      expect(data.id).toBe('test-snapshot-uuid');
      expect(data.totalGamesScanned).toBe(42);
    });

    it('должен находить снимок по дате (YYYY-MM-DD)', async () => {
      const res = await fetch(`${baseUrl}/api/snapshots/2026-09-14`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as MarketSnapshot;
      expect(data.id).toBe('test-snapshot-uuid-2');
      expect(data.totalGamesScanned).toBe(88);
    });

    it('должен находить снимок по имени файла без расширения (snapshot-YYYY-MM-DD)', async () => {
      const res = await fetch(`${baseUrl}/api/snapshots/snapshot-2026-09-14`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as MarketSnapshot;
      expect(data.id).toBe('test-snapshot-uuid-2');
    });

    it('должен возвращать 404, если снимок с указанным id не существует', async () => {
      const res = await fetch(`${baseUrl}/api/snapshots/non-existent-snapshot-id`);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });
  });

  describe('3. Эндпоинт GET /api/verdicts', () => {
    it('должен возвращать список вердиктов со статусами и скорингом', async () => {
      const res = await fetch(`${baseUrl}/api/verdicts`);
      expect(res.status).toBe(200);

      const verdicts = (await res.json()) as MarketVerdict[];
      expect(Array.isArray(verdicts)).toBe(true);
      expect(verdicts.length).toBe(1);

      const v = verdicts[0];
      expect(v.archetype).toBe('PHYSICS_SANDBOX');
      expect(v.status).toBe('GREEN_LIGHT');
      expect(v.opportunityScore.overallScore).toBe(88);
      expect(v.hasArbitrageOpportunity).toBe(true);
    });
  });

  describe('4. Эндпоинт POST /api/scan', () => {
    it('должен инициировать сканирование и возвращать обновленный снимок рынка', async () => {
      // POST /api/scan triggers runMarketScan
      const res = await fetch(`${baseUrl}/api/scan`, {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const snapshot = (await res.json()) as MarketSnapshot;

      expect(snapshot.id).toBeDefined();
      expect(snapshot.totalGamesScanned).toBeGreaterThan(0);
      expect(snapshot.games.length).toBeGreaterThan(0);
      expect(snapshot.verdicts.length).toBeGreaterThan(0);

      // Verify that store now holds this latest snapshot
      const latestFromStore = store.getLatestSnapshot();
      expect(latestFromStore?.id).toBe(snapshot.id);
    }, 45000);
  });

  describe('5. Раздача статических файлов клиентского бандла web/', () => {
    it('должен отдавать index.html для корневого пути /', async () => {
      const res = await fetch(`${baseUrl}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const text = await res.text();
      expect(text).toContain('Radar UI');
    });

    it('должен корректно отдавать JS и CSS с правильными MIME-типами', async () => {
      const jsRes = await fetch(`${baseUrl}/app.js`);
      expect(jsRes.status).toBe(200);
      expect(jsRes.headers.get('content-type')).toContain('application/javascript');
      expect(await jsRes.text()).toContain('radar');

      const cssRes = await fetch(`${baseUrl}/style.css`);
      expect(cssRes.status).toBe(200);
      expect(cssRes.headers.get('content-type')).toContain('text/css');
      expect(await cssRes.text()).toContain('background: black');
    });

    it('должен отдавать SPA fallback (index.html) для несуществующих клиентских путей', async () => {
      const res = await fetch(`${baseUrl}/dashboard/arbitrage`, {
        headers: { Accept: 'text/html,application/xhtml+xml' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(await res.text()).toContain('Radar UI');
    });

    it('должен возвращать 404 для несуществующих не-HTML файлов', async () => {
      const res = await fetch(`${baseUrl}/missing-image.png`);
      expect(res.status).toBe(404);
    });

    it('должен отклонять попытки выхода за пределы директории (directory traversal)', async () => {
      const resNorm = await fetch(`${baseUrl}/../../package.json`);
      expect([403, 404]).toContain(resNorm.status);

      const resEncoded = await fetch(`${baseUrl}/%2e%2e/%2e%2e/package.json`);
      expect([403, 404]).toContain(resEncoded.status);
    });

    it('должен безопасно вызывать openBrowser в тестовом окружении без сбоев', () => {
      expect(() => openBrowser('http://localhost:4200/')).not.toThrow();
    });

    it('должен корректно инициализировать сервер с явным флагом open: false', async () => {
      const s = createRadarServer({
        port: 0,
        host: '127.0.0.1',
        silent: true,
        open: false,
      });
      const allocatedPort = await s.start();
      expect(allocatedPort).toBeGreaterThan(0);
      await s.stop();
    });
  });
});
