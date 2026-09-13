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
}

export interface MarketSnapshot {
  id: string;
  timestamp: string;
  totalGamesScanned: number;
  platformCounts: Record<PlatformType, number>;
  robloxTotalCCU: number;
  games: NormalizedGame[];
  verdicts: MarketVerdict[];
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
