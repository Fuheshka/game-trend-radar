import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type * as http from 'node:http';
import { MarketScanner, ScanValidationError } from '../src/scanner.js';
import { SnapshotStore } from '../src/storage/snapshot_store.js';
import { MarketEventBus, createRadarServer } from '../src/server.js';
import { AutoScanner } from '../src/cron/auto_scan.js';
import type { NormalizedGame, PlatformType } from '../src/types/index.js';

const games = (n: number, platform: PlatformType): NormalizedGame[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${platform}_${i}`,
    platform,
    title: `Game ${i}`,
    genre: 'General',
    archetype: 'SIMULATION_INCREMENTAL',
    metricValue: 1000 + i,
    metricType: 'ccu',
    tags: [],
    timestamp: '2026-10-07T00:00:00.000Z',
  }));

const youtube = {
  getViralShortsTrends: async () => games(2, 'youtube_trends'),
  scanTrendingSlices: async () => [],
  detectViralMemes: () => [],
  calculateViralMultiplier: () => 1,
};

const tmpDirs: string[] = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-rel-'));
  tmpDirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('валидация скана', () => {
  it('отклоняет скан с пустым Roblox, не сохраняет снимок и шлёт scan:failed', async () => {
    const store = new SnapshotStore(tmp());
    const bus = new MarketEventBus();
    const failed: unknown[] = [];
    bus.on('scan:failed', d => failed.push(d));

    const scanner = new MarketScanner({
      store,
      silent: true,
      eventBus: bus,
      robloxCollector: { fetchAllKeySorts: async () => [] },
      yandexCollector: { fetchCatalog: async () => games(50, 'yandex_games') },
      pokiCollector: { fetchPopular: async () => games(50, 'poki') },
      youtubeAnalyzer: youtube,
    });

    await expect(scanner.scan()).rejects.toBeInstanceOf(ScanValidationError);
    expect(store.getLatestSnapshot()).toBeNull();
    expect(failed).toHaveLength(1);
  });

  it('падение второстепенного коллектора не валит скан и попадает в sourceStatus', async () => {
    const store = new SnapshotStore(tmp());
    const scanner = new MarketScanner({
      store,
      silent: true,
      robloxCollector: { fetchAllKeySorts: async () => games(40, 'roblox') },
      yandexCollector: {
        fetchCatalog: async () => {
          throw new Error('boom');
        },
      },
      pokiCollector: { fetchPopular: async () => games(20, 'poki') },
      youtubeAnalyzer: youtube,
    });

    const snap = await scanner.scan();
    expect(snap.sourceStatus?.yandex_games).toMatchObject({ ok: false, count: 0, error: 'boom' });
    expect(snap.sourceStatus?.roblox.ok).toBe(true);
    expect(store.getLatestSnapshot()?.id).toBe(snap.id);
  });
});

describe('SnapshotStore история', () => {
  it('пишет внутридневные точки и отдаёт их за период', async () => {
    const store = new SnapshotStore(tmp());
    const scanner = new MarketScanner({
      store,
      silent: true,
      robloxCollector: { fetchAllKeySorts: async () => games(10, 'roblox') },
      yandexCollector: { fetchCatalog: async () => games(5, 'yandex_games') },
      pokiCollector: { fetchPopular: async () => games(5, 'poki') },
      youtubeAnalyzer: youtube,
    });
    await scanner.scan();
    await scanner.scan();
    const points = store.getHistory(1);
    expect(points).toHaveLength(2);
    expect(points[0].totalGames).toBe(22);
    expect(points[0].verdicts.length).toBeGreaterThan(0);
  });
});

describe('SSE replay', () => {
  it('нумерует события и дошлёт пропущенные по Last-Event-ID', () => {
    const bus = new MarketEventBus({ eventIds: true });
    bus.broadcast('a', { n: 1 });
    bus.broadcast('b', { n: 2 });
    bus.broadcast('c', { n: 3 });

    const chunks: string[] = [];
    const res = { write: (d: string) => chunks.push(d) } as unknown as http.ServerResponse;
    bus.registerClient(res, 1);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe('id: 2\nevent: b\ndata: {"n":2}\n\n');
    expect(chunks[1]).toContain('id: 3\n');
  });
});

describe('AutoScanner', () => {
  it('запускает скан, повторяет по интервалу и уходит в backoff при сбое', async () => {
    let calls = 0;
    const logs: string[] = [];
    const scanner = new AutoScanner({
      intervalMs: 20,
      initialDelayMs: 1,
      getLastSnapshotTime: () => null,
      log: m => logs.push(m),
      run: async () => {
        calls++;
        if (calls === 1) throw new Error('fail');
      },
    });
    scanner.start();
    await new Promise(r => setTimeout(r, 120));
    scanner.stop();
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(logs[0]).toContain('сбой #1');
    expect(scanner.consecutiveFailures).toBe(0);
  });
});

describe('защита POST /api/scan', () => {
  it('401 без токена, 202 с токеном, 429 при повторе в cooldown', async () => {
    const dir = tmp();
    const server = createRadarServer({
      port: 0,
      host: '127.0.0.1',
      silent: true,
      open: false,
      store: new SnapshotStore(dir),
      staticDir: dir,
      scanToken: 's3cret',
      scanCooldownMs: 60_000,
      scanIntervalMinutes: 0,
    });
    const port = await server.start();
    const url = `http://127.0.0.1:${port}/api/scan`;
    try {
      expect((await fetch(url, { method: 'POST' })).status).toBe(401);
      expect((await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer wrong' } })).status).toBe(401);

      const ok = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer s3cret' } });
      expect(ok.status).toBe(202);
      expect((await ok.json()).status).toBe('started');

      const health = await fetch(`http://127.0.0.1:${port}/healthz`);
      expect(health.status).toBe(200);
      expect((await health.json()).status).toBeDefined();
    } finally {
      await server.stop();
    }
  });
});
