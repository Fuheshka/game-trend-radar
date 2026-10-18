import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { MarketScanner, assessSourceHealth } from '../src/scanner.js';
import { SnapshotStore } from '../src/storage/snapshot_store.js';
import { createRadarServer } from '../src/server.js';
import { describeSourceProblems } from '../web/src/components/HeaderStatusBar.js';
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

const tmpDirs: string[] = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-health-'));
  tmpDirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('assessSourceHealth: порог деградации', () => {
  it('без прошлого скана предупреждает только ниже абсолютного минимума', () => {
    expect(assessSourceHealth('poki', { ok: true, count: 100 })).toEqual({ ok: true, count: 100 });
    expect(assessSourceHealth('poki', { ok: true, count: 29 }).warning).toMatch(/29 игр.*не меньше 30/);
    expect(assessSourceHealth('yandex_games', { ok: true, count: 50 }).warning).toBeUndefined();
    expect(assessSourceHealth('yandex_games', { ok: true, count: 49 }).warning).toBeDefined();
  });

  it('падение ниже 50% от прошлого здорового скана — warning с базой; ровно 50% — норма', () => {
    const prev = { ok: true, count: 150 };
    const degraded = assessSourceHealth('yandex_games', { ok: true, count: 74 }, prev);
    expect(degraded).toMatchObject({ ok: true, count: 74, baseline: 150 });
    expect(degraded.warning).toContain('−51%');
    expect(assessSourceHealth('yandex_games', { ok: true, count: 75 }, prev)).toEqual({ ok: true, count: 75 });
  });

  it('база переносится через деградировавшие сканы и сбрасывается после восстановления', () => {
    const first = assessSourceHealth('poki', { ok: true, count: 40 }, { ok: true, count: 100 });
    expect(first.warning).toBeDefined();
    // Следующий скан с тем же малым count сравнивается со 100, а не с 40
    const second = assessSourceHealth('poki', { ok: true, count: 40 }, first);
    expect(second).toMatchObject({ baseline: 100 });
    expect(second.warning).toBeDefined();
    // Сбой (0 игр) тоже не обнуляет базу
    const failed = assessSourceHealth('poki', { ok: false, count: 0, error: 'boom' }, second);
    expect(failed).toEqual({ ok: false, count: 0, error: 'boom', baseline: 100 });
    const recovered = assessSourceHealth('poki', { ok: true, count: 95 }, failed);
    expect(recovered).toEqual({ ok: true, count: 95 });
  });

  it('YouTube Shorts не проверяется: малый и скачущий объём — норма', () => {
    expect(assessSourceHealth('youtube_shorts', { ok: true, count: 1 }, { ok: true, count: 8 })).toEqual({
      ok: true,
      count: 1,
    });
  });

  it('старые снимки без warning/baseline служат базой как есть', () => {
    expect(assessSourceHealth('roblox', { ok: true, count: 100 }, { ok: true, count: 279 }).baseline).toBe(279);
  });
});

describe('деградация источника в скане, /healthz и шапке', () => {
  const scanWith = (store: SnapshotStore, poki: number, timestamp: string) =>
    new MarketScanner({
      store,
      silent: true,
      timestamp,
      robloxCollector: { fetchAllKeySorts: async () => games(200, 'roblox') },
      yandexCollector: { fetchCatalog: async () => games(150, 'yandex_games') },
      pokiCollector: { fetchPopular: async () => games(poki, 'poki') },
      youtubeAnalyzer: {
        getViralShortsTrends: async () => games(3, 'youtube_trends'),
        scanTrendingSlices: async () => [],
        detectViralMemes: () => [],
        calculateViralMultiplier: () => 1,
      },
    }).scan();

  it('частичный сбор Poki помечается warning в снимке, но снимок сохраняется', async () => {
    const store = new SnapshotStore(tmp());
    const healthy = await scanWith(store, 100, '2026-10-18T10:00:00.000Z');
    expect(healthy.sourceStatus?.poki).toEqual({ ok: true, count: 100 });

    const partial = await scanWith(store, 35, '2026-10-18T10:30:00.000Z');
    expect(partial.sourceStatus?.poki).toMatchObject({ ok: true, count: 35, baseline: 100 });
    expect(partial.sourceStatus?.poki.warning).toBeDefined();
    expect(partial.sourceStatus?.yandex_games).toEqual({ ok: true, count: 150 });
    expect(store.getLatestSnapshot()?.sourceStatus?.poki.warning).toBeDefined();
  });

  it('/healthz отдаёт статусы источников последнего скана', async () => {
    const dir = tmp();
    const store = new SnapshotStore(dir);
    await scanWith(store, 100, '2026-10-18T10:00:00.000Z');
    await scanWith(store, 20, '2026-10-18T10:30:00.000Z');
    const server = createRadarServer({
      port: 0,
      host: '127.0.0.1',
      silent: true,
      open: false,
      store,
      staticDir: dir,
      scanIntervalMinutes: 0,
    });
    const port = await server.start();
    try {
      const health = await (await fetch(`http://127.0.0.1:${port}/healthz`)).json();
      expect(health.sources.poki).toMatchObject({ ok: true, count: 20, baseline: 100 });
      expect(health.sources.poki.warning).toMatch(/не меньше 30/);
      expect(health.sources.roblox.warning).toBeUndefined();
    } finally {
      await server.stop();
    }
  });

  it('шапка перечисляет сбойные и неполные источники, здоровые — нет', () => {
    expect(describeSourceProblems(undefined)).toEqual([]);
    expect(describeSourceProblems({ roblox: { ok: true, count: 279 } })).toEqual([]);
    const problems = describeSourceProblems({
      roblox: { ok: true, count: 279 },
      poki: { ok: true, count: 35, baseline: 100, warning: 'собрано 35 игр против 100' },
      yandex_games: { ok: false, count: 0, error: 'timeout' },
    });
    expect(problems.map(p => p.short)).toEqual(['Poki 35/100', 'Яндекс: сбой']);
    expect(problems[1].detail).toContain('timeout');
  });
});
