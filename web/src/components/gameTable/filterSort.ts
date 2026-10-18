import { NormalizedGame, PlatformType } from '../../types.js';
import { ARCHETYPE_RU_MAP } from './constants.js';
import { generateGameSparkline } from './sparkline.js';
import type { OpportunityScoreGetter, TableSortColumn, TableSortDirection } from './types.js';

export interface GameFilterState {
  platformFilter: 'all' | PlatformType;
  searchQuery: string;
  minCcu: number;
  sortColumn: TableSortColumn;
  sortDirection: TableSortDirection;
}

export function filterAndSortGames(
  games: NormalizedGame[],
  filters: GameFilterState,
  getOpportunityScore: OpportunityScoreGetter
): NormalizedGame[] {
  let result = games.slice();

  // 1. Min CCU filter
  if (filters.minCcu > 0) {
    result = result.filter(g => (g.metricType === 'ccu' ? g.metricValue >= filters.minCcu : false));
  }

  // 2. Platform filter
  if (filters.platformFilter !== 'all') {
    result = result.filter(g => g.platform === filters.platformFilter);
  }

  // 3. Search query filter
  if (filters.searchQuery) {
    const q = filters.searchQuery;
    result = result.filter(g => {
      const titleMatch = (g.title || '').toLowerCase().includes(q);
      const genreMatch = (g.genre || '').toLowerCase().includes(q);
      const archLabel = (ARCHETYPE_RU_MAP[g.archetype] || '').toLowerCase();
      const archMatch = archLabel.includes(q) || (g.archetype || '').toLowerCase().includes(q);
      const tagMatch = (g.tags || []).some(t => t.toLowerCase().includes(q));
      return titleMatch || genreMatch || archMatch || tagMatch;
    });
  }

  // 4. Sort (natural ascending cmp, negated if desc)
  result.sort((a, b) => {
    let cmp = 0;
    switch (filters.sortColumn) {
      case 'ccu':
        cmp = (a.metricValue || 0) - (b.metricValue || 0);
        break;
      case 'opportunity': {
        const scoreA = getOpportunityScore(a.archetype).score;
        const scoreB = getOpportunityScore(b.archetype).score;
        cmp = scoreA - scoreB;
        break;
      }
      case 'likes': {
        const lA = typeof a.likeRatio === 'number' ? a.likeRatio : 0;
        const lB = typeof b.likeRatio === 'number' ? b.likeRatio : 0;
        cmp = lA - lB;
        break;
      }
      case 'title':
        cmp = (a.title || '').localeCompare(b.title || '', 'ru', { sensitivity: 'base' });
        break;
      case 'platform':
        cmp = (a.platform || '').localeCompare(b.platform || '');
        break;
      case 'genre': {
        const gA = ARCHETYPE_RU_MAP[a.archetype] || a.genre || '';
        const gB = ARCHETYPE_RU_MAP[b.archetype] || b.genre || '';
        cmp = gA.localeCompare(gB, 'ru');
        break;
      }
      case 'trend': {
        const tA = generateGameSparkline(a).deltaPercent;
        const tB = generateGameSparkline(b).deltaPercent;
        cmp = tA - tB;
        break;
      }
      case 'rank':
      default:
        cmp = 0;
        break;
    }

    return filters.sortDirection === 'desc' ? -cmp : cmp;
  });

  return result;
}
