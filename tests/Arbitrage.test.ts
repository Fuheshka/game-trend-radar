import { describe, it, expect } from 'vitest';
import { ArbitrageAnalyzer } from '../src/analyzer/arbitrage.js';
import { SnapshotStore } from '../src/storage/snapshot_store.js';
import { MarketSnapshot, NormalizedGame } from '../src/types/index.js';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

describe('ArbitrageAnalyzer', () => {
  const analyzer = new ArbitrageAnalyzer();

  describe('1. Нормализация названий и очистка шума', () => {
    it('должен удалять квадратные и круглые скобки, эмодзи и служебные теги', () => {
      const rawTitle = '🕹️ [X10] [UPDATE] Steal An Egg | Candy & Chocolate! 🥚🔥';
      const normalized = analyzer.normalizeTitle(rawTitle);

      expect(normalized).not.toContain('[x10]');
      expect(normalized).not.toContain('[update]');
      expect(normalized).not.toContain('🕹️');
      expect(normalized).not.toContain('🥚');
      expect(normalized).not.toContain('🔥');
      expect(normalized).toBe('steal an egg candy chocolate');
    });

    it('должен корректно обрабатывать пустые строки и спецсимволы', () => {
      expect(analyzer.normalizeTitle('')).toBe('');
      expect(analyzer.normalizeTitle('   --- !!! ???   ')).toBe('');
      expect(analyzer.normalizeTitle('99 Nights in the Forest 🔦')).toBe('99 nights in the forest');
    });
  });

  describe('2. Двуязычное сопоставление игровых понятий (EN ↔ RU)', () => {
    it('должен извлекать концепты steal_item и egg из англоязычного и русскоязычного названий', () => {
      const conceptsEn = analyzer.extractConcepts('Steal An Egg from Dragon', ['simulator']);
      const conceptsRu = analyzer.extractConcepts('Укради яйцо у монстра', ['кликер']);

      expect(conceptsEn.has('steal_item')).toBe(true);
      expect(conceptsEn.has('egg')).toBe(true);
      expect(conceptsEn.has('simulator')).toBe(true);

      expect(conceptsRu.has('steal_item')).toBe(true);
      expect(conceptsRu.has('egg')).toBe(true);
      expect(conceptsRu.has('clicker')).toBe(true);
    });

    it('должен распознавать концепты рэгдолла, переломов и песочниц', () => {
      const conceptsEn = analyzer.extractConcepts('Ragdoll Dismount Break Bones');
      const conceptsRu = analyzer.extractConcepts('Сломай кости: Рэгдолл манекен');

      expect(conceptsEn.has('ragdoll')).toBe(true);
      expect(conceptsEn.has('break_bones')).toBe(true);

      expect(conceptsRu.has('ragdoll')).toBe(true);
      expect(conceptsRu.has('break_bones')).toBe(true);
    });
  });

  describe('3. Расчет семантической схожести между Roblox и Яндекс Играми', () => {
    it('должен давать высокий балл схожести для прямого аналога на русском языке', () => {
      const robloxGame: NormalizedGame = {
        id: 'roblox_1',
        platform: 'roblox',
        title: 'Steal An Egg',
        genre: 'Simulation',
        archetype: 'SIMULATION_INCREMENTAL',
        metricValue: 350000,
        metricType: 'ccu',
        tags: ['steal', 'egg'],
        timestamp: '2026-09-13T12:00:00Z',
      };

      const yandexAnalog: NormalizedGame = {
        id: 'yandex_1',
        platform: 'yandex_games',
        title: 'Укради яйцо: Побег',
        genre: 'Web Casual',
        archetype: 'SIMULATION_INCREMENTAL',
        metricValue: 85,
        metricType: 'rating',
        tags: ['yandex_catalog'],
        timestamp: '2026-09-13T12:00:00Z',
      };

      const result = analyzer.calculateSemanticSimilarity(robloxGame, yandexAnalog);

      expect(result.similarity).toBeGreaterThanOrEqual(0.70);
      expect(result.sharedConcepts).toContain('steal_item');
      expect(result.sharedConcepts).toContain('egg');
      expect(result.archetypeMatch).toBe(true);
    });

    it('должен давать низкий балл схожести для несвязанных игр', () => {
      const robloxGame: NormalizedGame = {
        id: 'roblox_2',
        platform: 'roblox',
        title: 'Steal An Egg',
        genre: 'Simulation',
        archetype: 'SIMULATION_INCREMENTAL',
        metricValue: 200000,
        metricType: 'ccu',
        tags: [],
        timestamp: '2026-09-13T12:00:00Z',
      };

      const yandexUnrelated: NormalizedGame = {
        id: 'yandex_2',
        platform: 'yandex_games',
        title: 'Филворды: Поиск Слов',
        genre: 'Word Puzzle',
        archetype: 'WORD_PUZZLE',
        metricValue: 90,
        metricType: 'rating',
        tags: [],
        timestamp: '2026-09-13T12:00:00Z',
      };

      const result = analyzer.calculateSemanticSimilarity(robloxGame, yandexUnrelated);

      expect(result.similarity).toBeLessThan(0.20);
      expect(result.archetypeMatch).toBe(false);
    });
  });

  describe('4. Выявление механик с CCU > 100k в Roblox без аналогов в топ-100 Яндекс Игр', () => {
    const robloxGames: NormalizedGame[] = [
      {
        id: 'roblox_hit_1',
        platform: 'roblox',
        title: 'Steal An Egg [X10 SPEED]',
        genre: 'Simulation',
        archetype: 'SIMULATION_INCREMENTAL',
        metricValue: 350000, // > 100k CCU, нет аналога
        metricType: 'ccu',
        tags: ['viral'],
        timestamp: '2026-09-13T12:00:00Z',
      },
      {
        id: 'roblox_hit_2',
        platform: 'roblox',
        title: 'Melon Sandbox Destruction',
        genre: 'Sandbox',
        archetype: 'PHYSICS_SANDBOX',
        metricValue: 120000, // > 100k CCU, ЕСТЬ аналог на ЯИ
        metricType: 'ccu',
        tags: [],
        timestamp: '2026-09-13T12:00:00Z',
      },
      {
        id: 'roblox_low_ccu',
        platform: 'roblox',
        title: 'Tiny Indie Obby',
        genre: 'Obby',
        archetype: 'OBBY_PARKOUR',
        metricValue: 25000, // <= 100k CCU, не должен быть отобран
        metricType: 'ccu',
        tags: [],
        timestamp: '2026-09-13T12:00:00Z',
      },
      {
        id: 'roblox_mega_hit',
        platform: 'roblox',
        title: '99 Nights in the Forest',
        genre: 'Horror',
        archetype: 'SURVIVAL_HORROR',
        metricValue: 650000, // > 500k CCU -> CRITICAL_FIRST_MOVER
        metricType: 'ccu',
        tags: ['horror', 'forest'],
        timestamp: '2026-09-13T12:00:00Z',
      },
    ];

    const yandexCatalog: NormalizedGame[] = [
      {
        id: 'yandex_1',
        platform: 'yandex_games',
        title: 'Мелон Песочница: Разрушение', // аналог для roblox_hit_2
        genre: 'Sandbox',
        archetype: 'PHYSICS_SANDBOX',
        metricValue: 95,
        metricType: 'rating',
        tags: [],
        timestamp: '2026-09-13T12:00:00Z',
      },
      {
        id: 'yandex_2',
        platform: 'yandex_games',
        title: 'Три в ряд: Конфетный сад',
        genre: 'Match 3',
        archetype: 'MERGE_IDLE',
        metricValue: 90,
        metricType: 'rating',
        tags: [],
        timestamp: '2026-09-13T12:00:00Z',
      },
      {
        id: 'yandex_3',
        platform: 'yandex_games',
        title: 'Кроссворды на каждый день',
        genre: 'Word',
        archetype: 'WORD_PUZZLE',
        metricValue: 88,
        metricType: 'rating',
        tags: [],
        timestamp: '2026-09-13T12:00:00Z',
      },
    ];

    it('должен находить только те игры, у которых CCU > 100k и нет прямого аналога в каталоге', () => {
      const opportunities = analyzer.findOpportunities(robloxGames, yandexCatalog);

      // Ожидаем 2 ниши: Steal An Egg (350k) и 99 Nights (650k)
      // Melon Sandbox отсекается, так как есть 'Мелон Песочница'
      // Tiny Indie Obby отсекается, так как CCU 25k < 100k
      expect(opportunities).toHaveLength(2);

      // Сортировка по CCU по убыванию
      expect(opportunities[0].robloxGame.id).toBe('roblox_mega_hit');
      expect(opportunities[0].robloxCCU).toBe(650000);
      expect(opportunities[0].badge).toBe('ARBITRAGE OPPORTUNITY');
      expect(opportunities[0].organicPotential).toBe('CRITICAL_FIRST_MOVER');

      expect(opportunities[1].robloxGame.id).toBe('roblox_hit_1');
      expect(opportunities[1].robloxCCU).toBe(350000);
      expect(opportunities[1].badge).toBe('ARBITRAGE OPPORTUNITY');
      expect(opportunities[1].organicPotential).toBe('VERY_HIGH');
    });

    it('должен генерировать привлекательное русское название и стратегию адаптации', () => {
      const opportunities = analyzer.findOpportunities(robloxGames, yandexCatalog);
      const eggOpp = opportunities.find(o => o.robloxGame.id === 'roblox_hit_1')!;

      expect(eggOpp.suggestedRuTitle).toContain('Укради Яйцо');
      expect(eggOpp.adaptationStrategy).toContain('Rewarded');
      expect(eggOpp.hasDirectAnalog).toBe(false);
      expect(eggOpp.similarityWithNearestAnalog).toBeLessThan(0.40);
    });
  });

  describe('5. Генерация отчета и бейджа «ARBITRAGE OPPORTUNITY»', () => {
    it('должен формировать валидный Markdown с бейджем и ТЗ на адаптацию', () => {
      const mockOpportunities = analyzer.findOpportunities(
        [
          {
            id: 'roblox_test',
            platform: 'roblox',
            title: 'Steal An Egg',
            genre: 'Simulation',
            archetype: 'SIMULATION_INCREMENTAL',
            metricValue: 400000,
            metricType: 'ccu',
            tags: [],
            url: 'https://www.roblox.com/games/123',
            timestamp: '2026-09-13T12:00:00Z',
          },
        ],
        []
      );

      const md = analyzer.generateMarkdownSection(mockOpportunities);

      expect(md).toContain('## 🎯 Арбитражные ниши: Хит в Roblox ➔ Отсутствует на Яндекс Играх');
      expect(md).toContain('[ARBITRAGE OPPORTUNITY]');
      expect(md).toContain('400,000 CCU');
      expect(md).toContain('Укради Яйцо: Побег от Монстра');
      expect(md).toContain('https://www.roblox.com/games/123');
    });

    it('должен корректно выводить пустую секцию при отсутствии арбитражных разрывов', () => {
      const md = analyzer.generateMarkdownSection([]);
      expect(md).toContain('Прямых арбитражных разрывов с онлайном > 100k CCU в текущей выборке не зафиксировано.');
    });

    it('должен интегрироваться со SnapshotStore и включать бейдж в Markdown отчет', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-test-'));
      try {
        const store = new SnapshotStore(tempDir);
        const opps = analyzer.findOpportunities(
          [
            {
              id: 'roblox_egg',
              platform: 'roblox',
              title: 'Steal An Egg',
              genre: 'Simulation',
              archetype: 'SIMULATION_INCREMENTAL',
              metricValue: 550000,
              metricType: 'ccu',
              tags: ['steal', 'egg'],
              url: 'https://www.roblox.com/games/egg',
              timestamp: '2026-09-13T12:00:00Z',
            },
          ],
          []
        );

        const mockSnapshot: MarketSnapshot = {
          id: 'test_snap',
          timestamp: '2026-09-13T12:00:00.000Z',
          totalGamesScanned: 1,
          platformCounts: {
            roblox: 1,
            yandex_games: 0,
            poki: 0,
            youtube_trends: 0,
          },
          robloxTotalCCU: 550000,
          games: [],
          verdicts: [
            {
              archetype: 'SIMULATION_INCREMENTAL',
              titleRu: '+1 Симулятор и Эволюция',
              status: 'GREEN_LIGHT',
              opportunityScore: {
                overallScore: 96,
                demandScore: 100,
                velocityScore: 100,
                monetizationScore: 90,
                saturationIndex: 1.5,
                productionEffort: 1.5,
              },
              totalAudienceCCU: 550000,
              marketSharePercent: 100,
              sampleTitles: ['Steal An Egg'],
              actionRecommendation: 'Брать в разработку',
              coreLoopBlueprint: 'Сбор -> Rebirth',
              monetizationStrategy: 'Rewarded',
              avoidPitfalls: 'Не затягивать старт',
              hasArbitrageOpportunity: true,
            },
          ],
          arbitrageOpportunities: opps,
        };

        const reportPath = store.generateMarkdownReport(mockSnapshot);
        const reportContent = fs.readFileSync(reportPath, 'utf-8');

        expect(reportContent).toContain('[ARBITRAGE OPPORTUNITY]');
        expect(reportContent).toContain('550,000 CCU');
        expect(reportContent).toContain('+1 Симулятор и Эволюция [ARBITRAGE OPPORTUNITY]');
        expect(reportContent).toContain('🚀 [ARBITRAGE OPPORTUNITY]');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
