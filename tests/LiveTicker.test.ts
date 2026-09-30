import { describe, it, expect } from 'vitest';
import { extractTickerSignals, formatCompactNumber } from '../web/src/components/LiveTicker.js';
import { FALLBACK_SNAPSHOT } from '../web/src/fallbackData.js';
import { MarketSnapshot } from '../web/src/types.js';

describe('LiveTicker (Бегущая строка ключевых сигналов рынка)', () => {
  describe('formatCompactNumber', () => {
    it('должен форматировать миллионы с суффиксом M', () => {
      expect(formatCompactNumber(1_600_000)).toBe('1.6M');
      expect(formatCompactNumber(2_824_620)).toBe('2.8M');
      expect(formatCompactNumber(1_000_000)).toBe('1M');
    });

    it('должен форматировать тысячи с суффиксом k', () => {
      expect(formatCompactNumber(546_396)).toBe('546.4k');
      expect(formatCompactNumber(185_400)).toBe('185.4k');
      expect(formatCompactNumber(1_000)).toBe('1k');
    });

    it('должен возвращать точные числа для значений меньше 1000', () => {
      expect(formatCompactNumber(98)).toBe('98');
      expect(formatCompactNumber(0)).toBe('0');
    });
  });

  describe('extractTickerSignals', () => {
    it('должен извлекать ключевые сигналы из снимка рынка', () => {
      const signals = extractTickerSignals(FALLBACK_SNAPSHOT);
      expect(signals.length).toBeGreaterThan(5);

      // Проверка наличия всех типов сигналов
      const types = signals.map(s => s.type);
      expect(types).toContain('online');
      expect(types).toContain('arbitrage');
      expect(types).toContain('shorts');
    });

    it('должен формировать правильные статусы и SVG-иконки без эмодзи', () => {
      const signals = extractTickerSignals(FALLBACK_SNAPSHOT);

      // 1. Онлайн Roblox (Steal An Egg: CCU)
      const stealEgg = signals.find(s => s.title.includes('Steal An Egg') && s.type === 'online');
      expect(stealEgg).toBeDefined();
      expect(stealEgg?.icon).toBe('flame');
      expect(stealEgg?.statusText).toMatch(/Steal An Egg: \d+(\.\d+)?M CCU/);

      // 2. Арбитраж (Арбитраж: Brookhaven RP (0 клонов в РФ))
      const brookhaven = signals.find(s => s.title.includes('Brookhaven'));
      expect(brookhaven).toBeDefined();
      expect(brookhaven?.icon).toBe('zap');
      expect(brookhaven?.statusText).toContain('0 клонов в РФ');

      // 3. YouTube Shorts (Shorts: Catch & Run 98 pts)
      const catchRun = signals.find(s => s.title.includes('Catch & Run'));
      expect(catchRun).toBeDefined();
      expect(catchRun?.icon).toBe('trending-up');
      expect(catchRun?.statusText).toMatch(/Shorts: Catch & Run 98 pts/);
    });

    it('должен содержать полные данные details для открывающегося Drawer', () => {
      const signals = extractTickerSignals(FALLBACK_SNAPSHOT);
      signals.forEach(sig => {
        expect(sig.id).toBeTruthy();
        expect(sig.title).toBeTruthy();
        expect(sig.searchFilter).toBeTruthy();
        expect(sig.details.categoryRu).toBeTruthy();
        expect(sig.details.metricLabel).toBeTruthy();
        expect(sig.details.metricValue).toBeTruthy();
        expect(sig.details.description).toBeTruthy();
      });
    });

    it('должен безопасно обрабатывать пустой или минимальный снимок', () => {
      const minimalSnapshot: MarketSnapshot = {
        id: 'min-1',
        timestamp: new Date().toISOString(),
        totalGamesScanned: 0,
        platformCounts: { roblox: 0, yandex_games: 0, poki: 0, youtube_trends: 0 },
        robloxTotalCCU: 0,
        games: [],
        verdicts: [],
      };

      const signals = extractTickerSignals(minimalSnapshot);
      expect(Array.isArray(signals)).toBe(true);
      expect(signals.length).toBe(0);
    });
  });
});
