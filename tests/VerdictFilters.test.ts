import { describe, it, expect } from 'vitest';
import { filterVerdicts, sortVerdicts, RadarFilters } from '../web/src/app/verdictFilters.js';
import { createAppState } from '../web/src/app/state.js';
import { FALLBACK_SNAPSHOT } from '../web/src/fallbackData.js';
import { MarketSnapshot } from '../web/src/types.js';

const snapshot = FALLBACK_SNAPSHOT as MarketSnapshot;
const base = (): RadarFilters => ({ ...createAppState().filters });

describe('фильтры и сортировка вердиктов радара', () => {
  it('по умолчанию видны все вердикты', () => {
    expect(filterVerdicts(snapshot, base())).toHaveLength(snapshot.verdicts.length);
  });

  it('архетип, статус и «арбитраж» сужают список', () => {
    const arch = snapshot.verdicts[0].archetype;
    expect(filterVerdicts(snapshot, { ...base(), archetype: arch }).map(v => v.archetype)).toEqual([arch]);

    const green = filterVerdicts(snapshot, { ...base(), status: 'GREEN_LIGHT' });
    expect(green.every(v => v.status === 'GREEN_LIGHT')).toBe(true);

    const arbitrage = filterVerdicts(snapshot, { ...base(), status: 'arbitrage' });
    expect(arbitrage.length).toBe(snapshot.verdicts.filter(v => v.hasArbitrageOpportunity).length);
  });

  it('поиск по названию вердикта', () => {
    const v = snapshot.verdicts[1];
    const found = filterVerdicts(snapshot, { ...base(), searchQuery: v.titleRu.toLowerCase() });
    expect(found.map(x => x.archetype)).toContain(v.archetype);
  });

  it('сортировки: по баллу в обе стороны, по названию', () => {
    const scores = (s: RadarFilters['sortBy']) =>
      sortVerdicts([...snapshot.verdicts], s).map(v => v.opportunityScore.overallScore);
    const desc = scores('score_desc');
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    expect(scores('score_asc')).toEqual([...desc].reverse());

    const titles = sortVerdicts([...snapshot.verdicts], 'title_asc').map(v => v.titleRu);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, 'ru')));
  });
});
