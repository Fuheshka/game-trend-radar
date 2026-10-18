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
  votes?: number; // Yandex: число оценок (ratingCount) — растёт с аудиторией
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

export interface SourceStatus {
  /** Коллектор вернул хотя бы одну игру. */
  ok: boolean;
  count: number;
  error?: string;
  /** Сбор подозрительно мал (вёрстка витрины поменялась?) — данные есть, но неполные. */
  warning?: string;
  /** Count последнего здорового скана; хранится, пока источник не восстановится. */
  baseline?: number;
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
  sourceStatus?: Record<string, SourceStatus>;
}

export interface SnapshotSummary {
  id: string;
  timestamp: string;
  date: string;
  totalGamesScanned: number;
  robloxTotalCCU?: number;
  filename: string;
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

export type TrendStatus = 'EMERGING' | 'VIRAL' | 'STABLE' | 'FADING';
export type MemeSourceType = 'youtube_autocomplete' | 'reddit_buzz' | 'roblox_ngram';

export interface DynamicMeme {
  id: string;
  name: string;
  keywords: string[];
  regexPattern: string;
  associatedArchetypes: GameArchetype[];
  confidenceScore: number;
  firstSeen: string;
  lastSeen: string;
  trendStatus: TrendStatus;
  sources: MemeSourceType[];
  velocityScore?: number;
  sampleTitles?: string[];
}

export interface DynamicMemesData {
  updatedAt: string;
  totalMemes: number;
  memes: DynamicMeme[];
}

