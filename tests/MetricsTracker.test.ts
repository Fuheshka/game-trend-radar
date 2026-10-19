import { describe, it, expect } from 'vitest';
import { MetricsTracker } from '../web/src/app/metricsController.js';
import { FALLBACK_SNAPSHOT } from '../web/src/fallbackData.js';
import { MarketSnapshot } from '../web/src/types.js';

function snap(id: string, robloxTotalCCU: number): MarketSnapshot {
  return { ...(FALLBACK_SNAPSHOT as MarketSnapshot), id, robloxTotalCCU };
}

describe('MetricsTracker: база для счётчиков и % изменения CCU', () => {
  it('первое обновление анимирует от самих значений, дальше — от показанных ранее', () => {
    const t = new MetricsTracker();
    const first = t.next(snap('a', 1_000_000), null);
    expect(first.from.totalCcu).toBe(first.metrics.totalCcu);

    const second = t.next(snap('b', 1_100_000), null);
    expect(second.from.totalCcu).toBe(1_000_000);
    expect(second.metrics.totalCcu).toBe(1_100_000);
  });

  it('демо-снимок на экране не база: после него % CCU = 0, после реального — считается', () => {
    const t = new MetricsTracker();
    t.next(FALLBACK_SNAPSHOT as MarketSnapshot, null);
    expect(t.next(snap('real-1', 1_000_000), null).metrics.ccuChangePercent).toBe(0);
    expect(t.next(snap('real-2', 1_100_000), null).metrics.ccuChangePercent).toBe(10);
  });

  it('предыдущий снимок истории важнее показанного ранее значения', () => {
    const t = new MetricsTracker();
    t.next(snap('real-1', 1_000_000), null);
    expect(t.next(snap('real-2', 1_100_000), snap('hist', 2_200_000)).metrics.ccuChangePercent).toBe(-50);
  });
});
