import { NormalizedGame, PlatformType, GameArchetype, MarketVerdict } from '../../types.js';

export type TableSortColumn =
  | 'rank'
  | 'platform'
  | 'title'
  | 'genre'
  | 'ccu'
  | 'trend'
  | 'opportunity'
  | 'likes';

export type TableSortDirection = 'asc' | 'desc';
export type TableViewMode = 'table' | 'grid';

export interface GameTableViewOptions {
  container: HTMLElement;
  games: NormalizedGame[];
  verdicts?: MarketVerdict[];
  onSelectGame: (game: NormalizedGame) => void;
  onTagClick?: (tag: string) => void;
  initialSortColumn?: TableSortColumn;
  initialSortDirection?: TableSortDirection;
  initialViewMode?: TableViewMode;
  initialPlatform?: 'all' | PlatformType;
  initialSearchQuery?: string;
  initialMinCcu?: number;
  initialLimit?: number;
  onViewModeChange?: (mode: TableViewMode) => void;
  onSortChange?: (column: TableSortColumn, direction: TableSortDirection) => void;
  onPlatformChange?: (platform: 'all' | PlatformType) => void;
  onFilterChange?: (filteredCount: number, totalCount: number) => void;
}

export interface SparklineData {
  points: number[];
  isPositive: boolean;
  deltaPercent: number;
  svgPath: string;
  endX: number;
  endY: number;
}

export type OpportunityScoreGetter = (archetype: GameArchetype) => { score: number; status: string };
