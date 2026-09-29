import { describe, it, expect } from 'vitest';
import { UnsupervisedTrendExtractor, ExtractedTrend } from '../src/analyzer/trend_extractor.js';
import { MarketSnapshot, NormalizedGame } from '../src/types/index.js';
import * as path from 'node:path';

describe('UnsupervisedTrendExtractor', () => {
  const extractor = new UnsupervisedTrendExtractor();

  describe('1. Очистка названий от рекламного мусора и нормализация', () => {
    it('должен удалять теги [UPDATE], [NEW], спецсимволы и эмодзи', () => {
      const raw = '🔥 [NEW] [UPDATE 5] Steal An Egg! (Trading & Candy) 🥚✨';
      const cleaned = extractor.cleanTitle(raw);
      expect(cleaned).toBe('steal an egg trading candy');
    });

    it('должен корректно обрабатывать пустые строки и шум', () => {
      expect(extractor.cleanTitle('')).toBe('');
      expect(extractor.cleanTitle('   [UPDATE] 🔥🔥   ')).toBe('');
      expect(extractor.cleanTitle('Tungsten Cube [TEST]')).toBe('tungsten cube');
    });
  });

  describe('2. Токенизация и построение биграмм и триграмм', () => {
    it('должен генерировать биграммы и триграммы из строки', () => {
      const ngrams = extractor.extractNgrams('steal an egg today');
      expect(ngrams.bigrams).toEqual(['steal an', 'an egg', 'egg today']);
      expect(ngrams.trigrams).toEqual(['steal an egg', 'an egg today']);
    });

    it('должен возвращать пустые массивы для слишком коротких строк', () => {
      const single = extractor.extractNgrams('roblox');
      expect(single.bigrams).toEqual([]);
      expect(single.trigrams).toEqual([]);

      const twoWords = extractor.extractNgrams('tungsten cube');
      expect(twoWords.bigrams).toEqual(['tungsten cube']);
      expect(twoWords.trigrams).toEqual([]);
    });
  });

  describe('3. Детекция аномалий роста (Velocity Spike) и пороги регистрации', () => {
    const makeGame = (id: string, title: string, ccu: number, archetype = 'OTHER_CASUAL', genre = '', tags: string[] = []): NormalizedGame => ({
      id,
      platform: 'roblox',
      title,
      genre,
      archetype: archetype as any,
      metricValue: ccu,
      metricType: 'ccu',
      tags,
      timestamp: new Date().toISOString(),
    });

    it('должен регистрировать тренд, если N-грамма встречается в 3+ играх и выросла в 2.5+ раза', () => {
      const prevSnapshot: MarketSnapshot = {
        id: 'snap-prev',
        timestamp: '2026-09-28T00:00:00.000Z',
        totalGamesScanned: 1,
        platformCounts: { roblox: 1, yandex_games: 0, poki: 0, youtube_trends: 0 },
        robloxTotalCCU: 1000,
        games: [
          makeGame('prev_1', 'Tungsten Cube Prototype', 1000),
        ],
        verdicts: [],
      };

      const currSnapshot: MarketSnapshot = {
        id: 'snap-curr',
        timestamp: '2026-09-29T00:00:00.000Z',
        totalGamesScanned: 3,
        platformCounts: { roblox: 3, yandex_games: 0, poki: 0, youtube_trends: 0 },
        robloxTotalCCU: 150000,
        games: [
          makeGame('curr_1', '[NEW] Tungsten Cube Sandbox', 50000, 'PHYSICS_SANDBOX', 'Physics', ['ragdoll', 'sandbox']),
          makeGame('curr_2', 'Tungsten Cube Simulator', 60000, 'SIMULATION_INCREMENTAL', 'Simulation', ['simulator']),
          makeGame('curr_3', 'Crush Tungsten Cube 💥', 40000, 'PHYSICS_SANDBOX', 'Action', ['destruction']),
        ],
        verdicts: [],
      };

      const trends = extractor.extractTrends(currSnapshot, prevSnapshot);
      const tungstenTrend = trends.find(t => t.ngram === 'tungsten cube');

      expect(tungstenTrend).toBeDefined();
      expect(tungstenTrend?.currentFrequency).toBe(3);
      expect(tungstenTrend?.previousFrequency).toBe(1);
      expect(tungstenTrend?.growthVelocity).toBe(3.0); // 3 / 1 = 3.0 >= 2.5
      expect(tungstenTrend?.totalCCU).toBe(150000);
      expect(tungstenTrend?.sampleTitles).toHaveLength(3);
    });

    it('НЕ должен регистрировать тренд, если N-грамма встречается менее чем в 3 играх', () => {
      const prevSnapshot: MarketSnapshot = {
        id: 'snap-prev',
        timestamp: '2026-09-28T00:00:00.000Z',
        totalGamesScanned: 0,
        platformCounts: { roblox: 0, yandex_games: 0, poki: 0, youtube_trends: 0 },
        robloxTotalCCU: 0,
        games: [],
        verdicts: [],
      };

      const currSnapshot: MarketSnapshot = {
        id: 'snap-curr',
        timestamp: '2026-09-29T00:00:00.000Z',
        totalGamesScanned: 2,
        platformCounts: { roblox: 2, yandex_games: 0, poki: 0, youtube_trends: 0 },
        robloxTotalCCU: 20000,
        games: [
          makeGame('g1', 'Rare Meme Game 1', 10000),
          makeGame('g2', 'Rare Meme Game 2', 10000),
        ],
        verdicts: [],
      };

      const trends = extractor.extractTrends(currSnapshot, prevSnapshot);
      const rareTrend = trends.find(t => t.ngram.includes('rare meme'));
      expect(rareTrend).toBeUndefined();
    });

    it('НЕ должен регистрировать тренд, если рост частоты менее 2.5 раза', () => {
      const prevSnapshot: MarketSnapshot = {
        id: 'snap-prev',
        timestamp: '2026-09-28T00:00:00.000Z',
        totalGamesScanned: 2,
        platformCounts: { roblox: 2, yandex_games: 0, poki: 0, youtube_trends: 0 },
        robloxTotalCCU: 20000,
        games: [
          makeGame('p1', 'Normal Game Alpha', 10000),
          makeGame('p2', 'Normal Game Beta', 10000),
        ],
        verdicts: [],
      };

      const currSnapshot: MarketSnapshot = {
        id: 'snap-curr',
        timestamp: '2026-09-29T00:00:00.000Z',
        totalGamesScanned: 3,
        platformCounts: { roblox: 3, yandex_games: 0, poki: 0, youtube_trends: 0 },
        robloxTotalCCU: 30000,
        games: [
          makeGame('c1', 'Normal Game Alpha', 10000),
          makeGame('c2', 'Normal Game Beta', 10000),
          makeGame('c3', 'Normal Game Gamma', 10000),
        ],
        verdicts: [],
      };

      // Рост с 2 до 3 = 1.5x (< 2.5x)
      const trends = extractor.extractTrends(currSnapshot, prevSnapshot);
      const normalTrend = trends.find(t => t.ngram === 'normal game');
      expect(normalTrend).toBeUndefined();
    });

    it('должен регистрировать новый вирусный прорыв, если ранее N-грамма отсутствовала (0 -> 3+)', () => {
      const prevSnapshot: MarketSnapshot = {
        id: 'snap-prev',
        timestamp: '2026-09-28T00:00:00.000Z',
        totalGamesScanned: 0,
        platformCounts: { roblox: 0, yandex_games: 0, poki: 0, youtube_trends: 0 },
        robloxTotalCCU: 0,
        games: [],
        verdicts: [],
      };

      const currSnapshot: MarketSnapshot = {
        id: 'snap-curr',
        timestamp: '2026-09-29T00:00:00.000Z',
        totalGamesScanned: 3,
        platformCounts: { roblox: 3, yandex_games: 0, poki: 0, youtube_trends: 0 },
        robloxTotalCCU: 300000,
        games: [
          makeGame('c1', 'Steal An Egg', 100000, 'SIMULATION_INCREMENTAL', 'Simulation', ['steal']),
          makeGame('c2', 'Steal An Egg Simulator', 120000, 'SIMULATION_INCREMENTAL', 'Simulation', ['simulator']),
          makeGame('c3', 'Steal An Egg From Monster', 80000, 'SIMULATION_INCREMENTAL', 'Simulation', ['steal']),
        ],
        verdicts: [],
      };

      const trends = extractor.extractTrends(currSnapshot, prevSnapshot);
      const eggTrend = trends.find(t => t.ngram === 'steal an egg');

      expect(eggTrend).toBeDefined();
      expect(eggTrend?.currentFrequency).toBe(3);
      expect(eggTrend?.previousFrequency).toBe(0);
      expect(eggTrend?.growthVelocity).toBeGreaterThanOrEqual(2.5);
      expect(eggTrend?.totalCCU).toBe(300000);
      expect(eggTrend?.archetype).toBe('SIMULATION_INCREMENTAL');
    });
  });

  describe('4. Определение связанного архетипа через classifier.ts', () => {
    it('должен определять PHYSICS_SANDBOX для мема с механикой разрушений и рэгдолла', () => {
      const prevSnapshot: MarketSnapshot = {
        id: 'p1',
        timestamp: '2026-09-28T00:00:00.000Z',
        totalGamesScanned: 0,
        platformCounts: { roblox: 0, yandex_games: 0, poki: 0, youtube_trends: 0 },
        robloxTotalCCU: 0,
        games: [],
        verdicts: [],
      };

      const currSnapshot: MarketSnapshot = {
        id: 'c1',
        timestamp: '2026-09-29T00:00:00.000Z',
        totalGamesScanned: 3,
        platformCounts: { roblox: 3, yandex_games: 0, poki: 0, youtube_trends: 0 },
        robloxTotalCCU: 90000,
        games: [
          {
            id: 'g1',
            platform: 'roblox',
            title: 'Tungsten Cube Ragdoll Dismount',
            genre: 'Sandbox',
            archetype: 'PHYSICS_SANDBOX',
            metricValue: 30000,
            metricType: 'ccu',
            tags: ['ragdoll', 'dismount'],
            timestamp: '2026-09-29T00:00:00.000Z',
          },
          {
            id: 'g2',
            platform: 'roblox',
            title: 'Tungsten Cube Physics Sandbox',
            genre: 'Sandbox',
            archetype: 'PHYSICS_SANDBOX',
            metricValue: 40000,
            metricType: 'ccu',
            tags: ['physics', 'sandbox'],
            timestamp: '2026-09-29T00:00:00.000Z',
          },
          {
            id: 'g3',
            platform: 'roblox',
            title: 'Tungsten Cube Destruction Test',
            genre: 'Sandbox',
            archetype: 'PHYSICS_SANDBOX',
            metricValue: 20000,
            metricType: 'ccu',
            tags: ['destruction', 'break'],
            timestamp: '2026-09-29T00:00:00.000Z',
          },
        ],
        verdicts: [],
      };

      const trends = extractor.extractTrends(currSnapshot, prevSnapshot);
      const trend = trends.find(t => t.ngram === 'tungsten cube');
      expect(trend).toBeDefined();
      expect(trend?.archetype).toBe('PHYSICS_SANDBOX');
    });
  });

  describe('5. Симуляция появления вирусных мемов и чартов YouTube/Roblox', () => {
    it('должен определять тренды по смешанной выборке Roblox и YouTube Shorts', () => {
      const prevSnapshot: MarketSnapshot = {
        id: 'p0',
        timestamp: '2026-09-28T00:00:00.000Z',
        totalGamesScanned: 1,
        platformCounts: { roblox: 1, yandex_games: 0, poki: 0, youtube_trends: 0 },
        robloxTotalCCU: 5000,
        games: [
          {
            id: 'old_1',
            platform: 'roblox',
            title: 'Classic Obby Run',
            genre: 'Adventure',
            archetype: 'OBBY_PARKOUR',
            metricValue: 5000,
            metricType: 'ccu',
            tags: ['obby'],
            timestamp: '2026-09-28T00:00:00.000Z',
          },
        ],
        verdicts: [],
      };

      const currSnapshot: MarketSnapshot = {
        id: 'c0',
        timestamp: '2026-09-29T00:00:00.000Z',
        totalGamesScanned: 5,
        platformCounts: { roblox: 3, yandex_games: 0, poki: 0, youtube_trends: 2 },
        robloxTotalCCU: 1200000,
        games: [
          {
            id: 'rbx_1',
            platform: 'roblox',
            title: '[UPDATE] Steal An Egg Fast',
            genre: 'Simulation',
            archetype: 'SIMULATION_INCREMENTAL',
            metricValue: 800000,
            metricType: 'ccu',
            tags: ['steal', 'simulator'],
            timestamp: '2026-09-29T00:00:00.000Z',
          },
          {
            id: 'rbx_2',
            platform: 'roblox',
            title: 'Steal An Egg Every Second',
            genre: 'Simulation',
            archetype: 'SIMULATION_INCREMENTAL',
            metricValue: 400000,
            metricType: 'ccu',
            tags: ['steal', '+1'],
            timestamp: '2026-09-29T00:00:00.000Z',
          },
          {
            id: 'yt_1',
            platform: 'youtube_trends',
            title: 'Steal An Egg Viral Challenge',
            genre: 'Viral Short Format',
            archetype: 'SIMULATION_INCREMENTAL',
            metricValue: 98,
            metricType: 'viral_score',
            tags: ['youtube_shorts', 'viral'],
            timestamp: '2026-09-29T00:00:00.000Z',
          },
        ],
        verdicts: [],
      };

      const trends = extractor.extractTrends(currSnapshot, prevSnapshot);
      const eggTrend = trends.find(t => t.ngram === 'steal an egg');
      expect(eggTrend).toBeDefined();
      expect(eggTrend?.sampleTitles).toContain('[UPDATE] Steal An Egg Fast');
      expect(eggTrend?.totalCCU).toBe(1200000);
      expect(eggTrend?.archetype).toBe('SIMULATION_INCREMENTAL');
    });

    it('должен уметь работать со снимками из data/snapshots/', () => {
      const snapshotsDir = path.resolve(process.cwd(), 'data', 'snapshots');
      const trends = extractor.detectTrendsFromDisk(snapshotsDir);
      expect(Array.isArray(trends)).toBe(true);
    });
  });
});
