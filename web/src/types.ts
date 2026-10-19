export type PlatformType = 'roblox' | 'yandex_games' | 'poki' | 'crazygames' | 'youtube_trends';

export const PLATFORM_TYPES: readonly PlatformType[] = ['roblox', 'yandex_games', 'poki', 'crazygames', 'youtube_trends'];

export type GameArchetype =
  | 'SIMULATION_INCREMENTAL'
  | 'PHYSICS_SANDBOX'
  | 'MERGE_IDLE'
  | 'SURVIVAL_HORROR'
  | 'WORD_PUZZLE'
  | 'ACTION_SHOOTER'
  | 'OBBY_PARKOUR'
  | 'OTHER_CASUAL';

export type VerdictStatus = 'GREEN_LIGHT' | 'YELLOW_LIGHT' | 'RED_LIGHT';

export interface NormalizedGame {
  id: string;
  platform: PlatformType;
  title: string;
  genre: string;
  archetype: GameArchetype;
  metricValue: number;
  metricType: 'ccu' | 'rating' | 'rank' | 'viral_score';
  likeRatio?: number;
  votes?: number;
  url?: string;
  tags: string[];
  sortSource?: string;
  timestamp: string;
}

export interface OpportunityScore {
  overallScore: number;
  demandScore: number;
  velocityScore: number;
  monetizationScore: number;
  saturationIndex: number;
  productionEffort: number;
  viralMultiplier?: number;
}

export interface MarketVerdict {
  archetype: GameArchetype;
  titleRu: string;
  status: VerdictStatus;
  opportunityScore: OpportunityScore;
  totalAudienceCCU: number;
  marketSharePercent: number;
  sampleTitles: string[];
  actionRecommendation: string;
  coreLoopBlueprint: string;
  monetizationStrategy: string;
  avoidPitfalls: string;
  hasArbitrageOpportunity?: boolean;
}

export interface ArbitrageAnalogMatch {
  id: string;
  title: string;
  similarity: number;
  archetype: GameArchetype;
}

export interface ArbitrageOpportunity {
  robloxGame: NormalizedGame;
  robloxCCU: number;
  archetype: GameArchetype;
  similarityWithNearestAnalog: number;
  nearestAnalog: ArbitrageAnalogMatch | null;
  hasDirectAnalog: boolean;
  nicheKeywords: string[];
  nicheDescription: string;
  adaptationStrategy: string;
  suggestedRuTitle: string;
  badge: 'ARBITRAGE OPPORTUNITY';
  organicPotential: 'HIGH' | 'VERY_HIGH' | 'CRITICAL_FIRST_MOVER';
}

/** Игра, впервые появившаяся в выдаче платформы за последние дни. */
export interface NewEntry {
  id: string;
  platform: PlatformType;
  title: string;
  url?: string;
  firstSeen: string;
  ageDays: number;
  metricType: string;
  metricValue: number;
  votes?: number;
}

/** Игра с самым быстрым ростом за окно (CCU, число оценок или позиция). */
export interface Riser {
  id: string;
  platform: PlatformType;
  title: string;
  url?: string;
  metricType: string;
  signal: 'ccu' | 'votes' | 'rank';
  from: number;
  to: number;
  growthPct: number;
  days: number;
}

export interface MarketSnapshot {
  id: string;
  timestamp: string;
  totalGamesScanned: number;
  platformCounts: Record<PlatformType, number>;
  robloxTotalCCU: number;
  games: NormalizedGame[];
  verdicts: MarketVerdict[];
  arbitrageOpportunities?: ArbitrageOpportunity[];
  /** Новинки выдачи за 7 дней (из истории по играм; нет у старых снимков). */
  newEntries?: NewEntry[];
  /** Самые быстрорастущие игры за 7 дней. */
  risers?: Riser[];
  /** Статус каждого коллектора в этом скане (отсутствует у старых снимков). */
  sourceStatus?: Record<string, { ok: boolean; count: number; error?: string; warning?: string; baseline?: number }>;
}

export interface SnapshotSummary {
  id: string;
  timestamp: string;
  date: string;
  totalGamesScanned: number;
  robloxTotalCCU?: number;
  filename: string;
}
