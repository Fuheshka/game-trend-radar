import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  exportSnapshotToMarkdown,
  exportSnapshotToJson,
  downloadBlob,
  generateExportFilename,
} from '../web/src/services/exporter.js';
import { MarketSnapshot, MarketVerdict, ArbitrageOpportunity } from '../web/src/types.js';

describe('Exporter Service (Экспорт аналитического среза в MD и JSON)', () => {
  const mockVerdict: MarketVerdict = {
    archetype: 'SIMULATION_INCREMENTAL',
    titleRu: 'Симуляторы роста',
    status: 'GREEN_LIGHT',
    opportunityScore: {
      overallScore: 92,
      demandScore: 95,
      velocityScore: 88,
      monetizationScore: 90,
      saturationIndex: 2.1,
      productionEffort: 2.5,
      viralMultiplier: 1.3,
    },
    totalAudienceCCU: 1250000,
    marketSharePercent: 28,
    sampleTitles: ['Grow Bigger', 'Eat Stars'],
    actionRecommendation: 'Создавать легковесный веб-клон с Rewarded Video',
    coreLoopBlueprint: 'Сбор -> Улучшение -> Сброс',
    monetizationStrategy: 'Rewarded video за буст x2',
    avoidPitfalls: 'Переусложненный онбординг',
    hasArbitrageOpportunity: true,
  };

  const mockArbitrage: ArbitrageOpportunity = {
    robloxGame: {
      id: 'roblox-101',
      title: 'Mega Simulator 2026',
      platform: 'roblox',
      playerCount: 185000,
      genre: 'Simulation',
      url: 'https://roblox.com/games/101',
    },
    robloxCCU: 185000,
    archetype: 'SIMULATION_INCREMENTAL',
    similarityWithNearestAnalog: 0.22,
    nearestAnalog: {
      id: 'ya-55',
      title: 'Простой кликер',
      platform: 'yandex_games',
      playerCount: 1200,
      genre: 'Simulation',
      similarityScore: 0.22,
    },
    hasDirectAnalog: false,
    nicheKeywords: ['симулятор', 'кликер', 'рост'],
    nicheDescription: 'Огромный спрос при отсутствии сильных аналогов на веб-витринах',
    adaptationStrategy: 'Перенос кор-механики с казуальным управлением под мобильный веб',
    suggestedRuTitle: 'Мега Симулятор Эволюции',
    badge: 'ARBITRAGE OPPORTUNITY',
    organicPotential: 'VERY_HIGH',
  };

  const mockSnapshot: MarketSnapshot = {
    id: 'snapshot-2026-09-30',
    timestamp: '2026-09-30T12:00:00.000Z',
    totalGamesScanned: 450,
    platformCounts: {
      roblox: 220,
      yandex_games: 130,
      poki: 95,
      youtube_trends: 5,
    },
    robloxTotalCCU: 4800000,
    games: [mockArbitrage.robloxGame],
    verdicts: [mockVerdict],
    arbitrageOpportunities: [mockArbitrage],
  };

  describe('1. Генерация Markdown-отчета', () => {
    it('должен генерировать отчет с датой и глобальными метриками рынка', () => {
      const md = exportSnapshotToMarkdown(mockSnapshot);

      expect(md).toContain('# Отчет радара игровых трендов: 2026-09-30');
      expect(md).toContain('450');
      expect(md).toContain('4,800,000');
      expect(md).toContain('Roblox (220)');
      expect(md).toContain('Яндекс Игры (130)');
      expect(md).toContain('Poki (95)');
    });

    it('должен формировать чистую Markdown-таблицу арбитражных связок', () => {
      const md = exportSnapshotToMarkdown(mockSnapshot);

      expect(md).toContain('## Таблица арбитражных связок (Roblox -> Яндекс Игры)');
      expect(md).toContain('| Донор (Roblox) | Спрос (CCU) | Архетип | Ближайший аналог | Сходство | Потенциал | Рекомендуемое название (RU) |');
      expect(md).toContain('| Mega Simulator 2026 | 185,000 | Симуляторы роста | «Простой кликер» | 22% | VERY_HIGH | **Мега Симулятор Эволюции** |');
    });

    it('должен выводить топ вердиктов со скорингом и рекомендациями', () => {
      const md = exportSnapshotToMarkdown(mockSnapshot);

      expect(md).toContain('## Топ вердиктов и скоринг ниш');
      expect(md).toContain('### 🟢 Симуляторы роста');
      expect(md).toContain('Opportunity Score: 92/100');
      expect(md).toContain('1,250,000');
      expect(md).toContain('Создавать легковесный веб-клон');
    });

    it('должен включать сводную таблицу скоринга по жанрам', () => {
      const md = exportSnapshotToMarkdown(mockSnapshot);

      expect(md).toContain('## Сводная матрица скоринга по жанрам');
      expect(md).toContain('| Жанр / Архетип | Статус | Score | Спрос | Динамика | Viral Boost | Арбитраж |');
      expect(md).toContain('| Симуляторы роста | 🟢 Зеленый | **92** | 95 | 88 | 1.3x | 🚀 ARBITRAGE |');
    });

    it('не должен содержать длинных тире (—) в русском тексте', () => {
      const md = exportSnapshotToMarkdown(mockSnapshot);
      expect(md).not.toContain('—');
    });

    it('должен корректно обрабатывать пустой снимок без ошибок', () => {
      const emptySnapshot: MarketSnapshot = {
        id: 'snapshot-empty',
        timestamp: '2026-09-30T00:00:00.000Z',
        totalGamesScanned: 0,
        platformCounts: { roblox: 0, yandex_games: 0, poki: 0, youtube_trends: 0 },
        robloxTotalCCU: 0,
        games: [],
        verdicts: [],
        arbitrageOpportunities: [],
      };

      const md = exportSnapshotToMarkdown(emptySnapshot);
      expect(md).toContain('# Отчет радара игровых трендов');
      expect(md).toContain('0');
    });
  });

  describe('2. Экспорт в JSON', () => {
    it('должен сериализовать срез в валидный форматированный JSON', () => {
      const jsonStr = exportSnapshotToJson(mockSnapshot);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.id).toBe('snapshot-2026-09-30');
      expect(parsed.totalGamesScanned).toBe(450);
      expect(parsed.verdicts).toHaveLength(1);
      expect(parsed.arbitrageOpportunities).toHaveLength(1);
      expect(parsed.arbitrageOpportunities[0].robloxCCU).toBe(185000);
    });
  });

  describe('3. Именование файлов', () => {
    it('должен генерировать осмысленные имена файлов с датой', () => {
      const mdName = generateExportFilename(mockSnapshot, 'md');
      const jsonName = generateExportFilename(mockSnapshot, 'json');

      expect(mdName).toBe('game-trend-radar-report-2026-09-30.md');
      expect(jsonName).toBe('game-trend-radar-snapshot-2026-09-30.json');
    });

    it('должен использовать текущую дату при отсутствии таймстемпа', () => {
      const noDateSnapshot: MarketSnapshot = {
        ...mockSnapshot,
        timestamp: '',
      };
      const name = generateExportFilename(noDateSnapshot, 'md');
      expect(name).toMatch(/^game-trend-radar-report-\d{4}-\d{2}-\d{2}\.md$/);
    });
  });

  describe('4. Клиентское скачивание через Blob URL', () => {
    let originalDocument: any;
    let originalURL: any;

    beforeEach(() => {
      originalDocument = (global as any).document;
      originalURL = (global as any).URL;
    });

    afterEach(() => {
      (global as any).document = originalDocument;
      (global as any).URL = originalURL;
    });

    it('должен создавать Blob, Blob URL, инициировать клик на <a> и очищать URL', () => {
      const mockClick = vi.fn();
      const mockAppendChild = vi.fn();
      const mockRemoveChild = vi.fn();
      const mockAnchor: any = {
        href: '',
        download: '',
        click: mockClick,
      };

      (global as any).document = {
        createElement: vi.fn((tag: string) => {
          if (tag === 'a') return mockAnchor;
          return {};
        }),
        body: {
          appendChild: mockAppendChild,
          removeChild: mockRemoveChild,
        },
      };

      const mockCreateObjectURL = vi.fn(() => 'blob:http://localhost:4200/fake-uuid');
      const mockRevokeObjectURL = vi.fn();
      (global as any).URL = {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      };

      downloadBlob('test content', 'report.md', 'text/markdown;charset=utf-8');

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      expect(mockAnchor.download).toBe('report.md');
      expect(mockAnchor.href).toBe('blob:http://localhost:4200/fake-uuid');
      expect(mockAppendChild).toHaveBeenCalledWith(mockAnchor);
      expect(mockClick).toHaveBeenCalledTimes(1);
      expect(mockRemoveChild).toHaveBeenCalledWith(mockAnchor);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://localhost:4200/fake-uuid');
    });
  });
});
