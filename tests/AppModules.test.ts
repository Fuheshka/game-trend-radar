import { describe, it, expect } from 'vitest';
import { POPULAR_SEARCH_TAGS, countGamesForTag, isTagActive, verdictMatchesQuery } from '../web/src/app/search.js';
import { computeMarketMetrics } from '../web/src/app/metrics.js';
import { formatCompactNumber, formatSnapshotDateRu } from '../web/src/utils/format.js';
import { FALLBACK_SNAPSHOT } from '../web/src/fallbackData.js';
import { MarketSnapshot } from '../web/src/types.js';

describe('модули App: поиск, метрики, форматирование', () => {
  it('formatSnapshotDateRu и formatCompactNumber', () => {
    expect(formatSnapshotDateRu('2026-10-18T03:00:00Z')).toBe('18 окт');
    expect(formatSnapshotDateRu('not-a-date')).toBe('not-a-date');
    expect(formatCompactNumber(1_234_567)).toBe('1.2M');
    expect(formatCompactNumber(12_345)).toBe('12.3k');
  });

  it('isTagActive учитывает запрос, метку и частичное совпадение', () => {
    const horror = POPULAR_SEARCH_TAGS.find(t => t.id === 'horror')!;
    expect(isTagActive(horror, '')).toBe(false);
    expect(isTagActive(horror, 'Хоррор')).toBe(true);
    expect(isTagActive(horror, 'хорр')).toBe(true);
    expect(isTagActive(horror, 'обби')).toBe(false);
  });

  it('countGamesForTag и verdictMatchesQuery работают на демо-снимке', () => {
    const snapshot = FALLBACK_SNAPSHOT as MarketSnapshot;
    const total = POPULAR_SEARCH_TAGS.reduce((n, t) => n + countGamesForTag(t, snapshot), 0);
    expect(total).toBeGreaterThan(0);
    const v = snapshot.verdicts[0];
    expect(verdictMatchesQuery(v, '', snapshot.games || [])).toBe(true);
    expect(verdictMatchesQuery(v, v.titleRu, snapshot.games || [])).toBe(true);
  });

  it('computeMarketMetrics: % изменения CCU считается от прежнего значения, если истории нет', () => {
    const snapshot = { ...(FALLBACK_SNAPSHOT as MarketSnapshot), robloxTotalCCU: 1_100_000 };
    expect(computeMarketMetrics(snapshot, null, 1_000_000).ccuChangePercent).toBe(10);
    expect(computeMarketMetrics(snapshot, null, 0).ccuChangePercent).toBe(0);
    const prev = { ...snapshot, robloxTotalCCU: 2_200_000 };
    expect(computeMarketMetrics(snapshot, prev, 1_000_000).ccuChangePercent).toBe(-50);
  });
});
