import {
  MarketSnapshot,
  NormalizedGame,
  MarketVerdict,
  GameArchetype,
} from '../../types.js';

export type GainersSortMode = 'abs' | 'pct';

export interface SparklineData {
  points: number[];
  isPositive: boolean;
  deltaPercent: number;
  svgPath: string;
  endX: number;
  endY: number;
}

export interface GainerItem {
  game: NormalizedGame;
  rank: number;
  currentCcu: number;
  prevCcu: number;
  absDiff: number;
  pctDiff: number;
  sparkline: SparklineData;
}

export interface ViralSignalItem {
  id: string;
  trendTitle: string;
  viralMultiplier: number;
  archetype: GameArchetype;
  metricValue: number;
  sampleTitles: string[];
  sparkline: SparklineData;
  associatedGame?: NormalizedGame;
  verdict?: MarketVerdict;
}

export interface BreakoutItem {
  game: NormalizedGame;
  rank: number;
  ccu: number;
  ageDays: number;
  growthBadge: string;
  sparkline: SparklineData;
}

export interface MoversViewOptions {
  container: HTMLElement;
  currentSnapshot?: MarketSnapshot | null;
  previousSnapshot?: MarketSnapshot | null;
  initialGainersSort?: GainersSortMode;
  onSelectGame?: (game: NormalizedGame) => void;
  onSelectArchetype?: (archetype: GameArchetype) => void;
  onTagClick?: (tag: string) => void;
}
