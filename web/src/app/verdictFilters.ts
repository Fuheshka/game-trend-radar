/**
 * Фильтры и сортировка вердиктов вкладки «Радар». Чистые функции: состояние фильтров — в AppState.
 */
import { MarketSnapshot, MarketVerdict, GameArchetype, PlatformType, PLATFORM_TYPES } from '../types.js';
import { verdictMatchesQuery } from './search.js';

export const VERDICT_SORTS = ['score_desc', 'score_asc', 'ccu_desc', 'velocity_desc', 'title_asc'] as const;
export type VerdictSort = (typeof VERDICT_SORTS)[number];
export const STATUS_FILTERS = ['all', 'GREEN_LIGHT', 'YELLOW_LIGHT', 'RED_LIGHT', 'arbitrage'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
export const PLATFORM_FILTERS = ['all', ...PLATFORM_TYPES] as const;

export interface RadarFilters {
  platform: 'all' | PlatformType;
  status: StatusFilter;
  archetype: GameArchetype | null;
  searchQuery: string;
  sortBy: VerdictSort;
}

export function filterVerdicts(snapshot: MarketSnapshot, filters: RadarFilters): MarketVerdict[] {
  return (snapshot.verdicts || []).filter(v => {
    // 1. Archetype selection filter
    if (filters.archetype && v.archetype !== filters.archetype) {
      return false;
    }

    // 2. Status filter
    if (filters.status !== 'all') {
      if (filters.status === 'arbitrage') {
        if (!v.hasArbitrageOpportunity) return false;
      } else if (v.status !== filters.status) {
        return false;
      }
    }

    // 3. Platform filter: check if verdict has games matching platform
    if (filters.platform !== 'all') {
      const platformGames = (snapshot.games || []).filter(
        g => g.platform === filters.platform && g.archetype === v.archetype
      );
      // Also allow if verdict sampleTitles has matches or if platform counts match
      if (platformGames.length === 0 && filters.platform !== 'roblox') {
        // Allow fallback pass if it matches archetype
        const hasSamples = v.sampleTitles.some(t => t.length > 0);
        if (!hasSamples) return false;
      }
    }

    // 4. Search query & dynamic tags
    if (filters.searchQuery) {
      if (!verdictMatchesQuery(v, filters.searchQuery, snapshot.games || [])) {
        return false;
      }
    }

    return true;
  });
}

/** Сортирует на месте и возвращает тот же массив. */
export function sortVerdicts(verdicts: MarketVerdict[], sortBy: VerdictSort): MarketVerdict[] {
  return verdicts.sort((a, b) => {
    switch (sortBy) {
      case 'score_desc':
        return b.opportunityScore.overallScore - a.opportunityScore.overallScore;
      case 'score_asc':
        return a.opportunityScore.overallScore - b.opportunityScore.overallScore;
      case 'ccu_desc':
        return b.totalAudienceCCU - a.totalAudienceCCU;
      case 'velocity_desc':
        return b.opportunityScore.velocityScore - a.opportunityScore.velocityScore;
      case 'title_asc':
        return a.titleRu.localeCompare(b.titleRu, 'ru');
      default:
        return 0;
    }
  });
}
