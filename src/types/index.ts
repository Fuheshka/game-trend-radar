export type PlatformType = 'roblox' | 'yandex_games' | 'poki' | 'youtube_trends';

export type GameArchetype =
  | 'SIMULATION_INCREMENTAL'   // +1, Evolution, Simulator, Mining, Steal
  | 'PHYSICS_SANDBOX'          // Ragdoll, Melon, Destruction, Dismount
  | 'MERGE_IDLE'               // Merge, Sorting, Idle Tycoon
  | 'SURVIVAL_HORROR'          // 99 Nights, Escape, Doors, FNAF
  | 'WORD_PUZZLE'              // Filwords, Crosswords, Brain Test
  | 'ACTION_SHOOTER'           // Standoff, Battleground, Strike
  | 'OBBY_PARKOUR'             // Obby, Tower of Hell, Parkour
  | 'OTHER_CASUAL';

export type VerdictStatus = 'GREEN_LIGHT' | 'YELLOW_LIGHT' | 'RED_LIGHT';

export interface NormalizedGame {
  id: string;
  platform: PlatformType;
  title: string;
  genre: string;
  archetype: GameArchetype;
  metricValue: number; // Roblox CCU, Yandex Rating (0-100), Poki Rank
  metricType: 'ccu' | 'rating' | 'rank' | 'viral_score';
  likeRatio?: number; // 0.0 to 1.0
  url?: string;
  tags: string[];
  sortSource?: string;
  timestamp: string;
}

export interface OpportunityScore {
  overallScore: number; // 0 - 100
  demandScore: number; // 0 - 100
  velocityScore: number; // 0 - 100
  monetizationScore: number; // 0 - 100
  saturationIndex: number; // 1.0 - 5.0 (higher = worse)
  productionEffort: number; // 1.0 - 5.0 (higher = harder)
  viralMultiplier?: number; // 1.0 - 2.5 (acceleration multiplier from YouTube Shorts)
}

export interface ShortsVideoItem {
  id: string;
  title: string;
  description: string;
  viewCount: number;
  publishedAt?: string;
  url: string;
  channelTitle?: string;
  matchedTags?: string[];
}

export interface DetectedMemeTrend {
  memeId: string;
  name: string;
  pattern: string;
  occurrences: number;
  totalViews: number;
  avgViews: number;
  viralMultiplier: number;
  sampleTitles: string[];
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

export interface RawRobloxGame {
  universeId: number;
  rootPlaceId: number;
  name: string;
  playerCount: number;
  totalUpVotes: number;
  totalDownVotes: number;
  isSponsored?: boolean;
  genreL1?: string;
  ageRecommendationDisplayName?: string;
}

export interface RawYandexGame {
  appId: string;
  title: string;
  url: string;
  rating?: number;
  tags: string[];
  category: string;
}
