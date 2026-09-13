export type PlatformType = 'roblox' | 'yandex_games' | 'poki' | 'youtube_trends';

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

export interface MarketSnapshot {
  id: string;
  timestamp: string;
  totalGamesScanned: number;
  platformCounts: Record<PlatformType, number>;
  robloxTotalCCU: number;
  games: NormalizedGame[];
  verdicts: MarketVerdict[];
  arbitrageOpportunities?: ArbitrageOpportunity[];
}
