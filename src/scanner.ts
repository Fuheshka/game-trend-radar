import { EventEmitter } from 'node:events';
import { RobloxCollector } from './collectors/roblox.js';
import { YandexGamesCollector } from './collectors/yandex_games.js';
import { PokiCollector } from './collectors/poki.js';
import { YouTubeShortsAnalyzer } from './collectors/youtube_shorts.js';
import { OpportunityScorer } from './analyzer/scorer.js';
import { VerdictEngine } from './analyzer/verdict.js';
import { ArbitrageAnalyzer } from './analyzer/arbitrage.js';
import { SnapshotStore } from './storage/snapshot_store.js';
import { GameArchetype, MarketSnapshot, NormalizedGame, PlatformType } from './types/index.js';
import { MarketEventBus } from './events/event_bus.js';

export type CollectorSource = 'roblox' | 'yandex_games' | 'poki' | 'youtube_shorts';

export interface CollectorProgressEvent {
  source: CollectorSource;
  count: number;
  pct: number;
}

export interface ScanStartedEvent {
  timestamp: string;
}

export interface ScanCompletedEvent {
  snapshotId: string;
  totalGames: number;
  timestamp?: string;
}

export interface ScanOptions {
  store?: SnapshotStore;
  silent?: boolean;
}

export interface MarketScannerOptions extends ScanOptions {
  eventBus?: MarketEventBus;
  onProgress?: (progress: CollectorProgressEvent) => void;
  snapshotId?: string;
  timestamp?: string;
  robloxCollector?: { fetchAllKeySorts: () => Promise<NormalizedGame[]> };
  yandexCollector?: { fetchCatalog: () => Promise<NormalizedGame[]> };
  pokiCollector?: { fetchPopular: () => Promise<NormalizedGame[]> };
  youtubeAnalyzer?: {
    getViralShortsTrends: () => Promise<NormalizedGame[]>;
    scanTrendingSlices: (tags: string[]) => Promise<any[]>;
    detectViralMemes: (videos: any[]) => any[];
    calculateViralMultiplier: (archetype: GameArchetype, memes: any[]) => number;
  };
  scorer?: OpportunityScorer;
  verdictEngine?: VerdictEngine;
  arbitrageAnalyzer?: ArbitrageAnalyzer;
}

export class MarketScanner extends EventEmitter {
  private options: MarketScannerOptions;
  private eventBus?: MarketEventBus;
  private onProgressCallback?: (progress: CollectorProgressEvent) => void;

  constructor(
    optionsOrBusOrProgress?: MarketScannerOptions | MarketEventBus | ((progress: CollectorProgressEvent) => void),
    onProgress?: (progress: CollectorProgressEvent) => void
  ) {
    super();
    if (typeof optionsOrBusOrProgress === 'function') {
      this.options = {};
      this.onProgressCallback = optionsOrBusOrProgress;
    } else if (
      optionsOrBusOrProgress &&
      ('broadcast' in optionsOrBusOrProgress || optionsOrBusOrProgress instanceof MarketEventBus)
    ) {
      this.eventBus = optionsOrBusOrProgress as MarketEventBus;
      this.options = { eventBus: this.eventBus };
      if (typeof onProgress === 'function') {
        this.onProgressCallback = onProgress;
      }
    } else {
      this.options = (optionsOrBusOrProgress as MarketScannerOptions) || {};
      this.eventBus = this.options.eventBus;
      this.onProgressCallback = this.options.onProgress ?? (typeof onProgress === 'function' ? onProgress : undefined);
    }
  }

  private emitProgress(source: CollectorSource, count: number, pct: number): void {
    const payload: CollectorProgressEvent = { source, count, pct };
    this.emit('collector:progress', payload);
    this.emit('scan:progress', payload);
    this.onProgressCallback?.(payload);
    this.eventBus?.broadcast('collector:progress', payload);
  }

  public async scan(): Promise<MarketSnapshot> {
    const log = this.options.silent ? () => {} : console.log;

    log('\n======================================================');
    log('📡 GAME TREND RADAR | Сбор и анализ игрового рынка');
    log('======================================================\n');

    const startTime = this.options.timestamp ?? new Date().toISOString();
    const startedPayload: ScanStartedEvent = { timestamp: startTime };
    this.emit('scan:started', startedPayload);
    this.eventBus?.broadcast('scan:started', startedPayload);

    const robloxCollector = this.options.robloxCollector ?? new RobloxCollector();
    const yandexCollector = this.options.yandexCollector ?? new YandexGamesCollector();
    const pokiCollector = this.options.pokiCollector ?? new PokiCollector();
    const youtubeAnalyzer = this.options.youtubeAnalyzer ?? new YouTubeShortsAnalyzer();
    const scorer = this.options.scorer ?? new OpportunityScorer();
    const verdictEngine = this.options.verdictEngine ?? new VerdictEngine();
    const arbitrageAnalyzer = this.options.arbitrageAnalyzer ?? new ArbitrageAnalyzer();
    const store = this.options.store ?? new SnapshotStore();

    log('⏳ Опрос витрин данных...');

    // 1. Roblox (pct: 25)
    const robloxGames = await robloxCollector.fetchAllKeySorts();
    log(`  [+] Roblox: получено ${robloxGames.length} игр из ключевых чартов`);
    let cumulativeCount = robloxGames.length;
    this.emitProgress('roblox', cumulativeCount, 25);

    // 2. Яндекс Игры (pct: 55)
    const yandexGames = await yandexCollector.fetchCatalog();
    log(`  [+] Яндекс Игры: получено ${yandexGames.length} карточек каталога`);
    cumulativeCount += yandexGames.length;
    this.emitProgress('yandex_games', cumulativeCount, 55);

    // 3. Poki (pct: 75)
    const pokiGames = await pokiCollector.fetchPopular();
    log(`  [+] Poki: получено ${pokiGames.length} популярных веб-игр`);
    cumulativeCount += pokiGames.length;
    this.emitProgress('poki', cumulativeCount, 75);

    // 4. YouTube Shorts (pct: 90)
    const [ytTrends, shortsVideos] = await Promise.all([
      youtubeAnalyzer.getViralShortsTrends(),
      youtubeAnalyzer.scanTrendingSlices(['#shorts', '#roblox', '#gamedev']),
    ]);
    log(`  [+] YouTube Shorts: получено ${ytTrends.length} вирусных позиций`);
    cumulativeCount += ytTrends.length;
    this.emitProgress('youtube_shorts', cumulativeCount, 90);

    const detectedMemes = youtubeAnalyzer.detectViralMemes(shortsVideos);
    const activeMemes = detectedMemes.filter(m => m.occurrences > 0);
    if (activeMemes.length > 0) {
      log('\n🔥 Детекция вирусных персонажей и мемов (Shorts):');
      for (const m of activeMemes) {
        log(`  [🔥] ${m.name}: ${m.occurrences} видео, ~${m.totalViews.toLocaleString()} просмотров (Ускорение: ${m.viralMultiplier}x)`);
      }
    }

    const allGames: NormalizedGame[] = [...robloxGames, ...yandexGames, ...pokiGames, ...ytTrends];
    log(`\n📊 Всего собрано: ${allGames.length} игровых позиций`);

    // Aggregate by archetype
    const archetypeStats = new Map<
      GameArchetype,
      {
        totalCCU: number;
        titles: string[];
        count: number;
        hasUpAndComing: boolean;
      }
    >();

    const platformCounts: Record<PlatformType, number> = {
      roblox: robloxGames.length,
      yandex_games: yandexGames.length,
      poki: pokiGames.length,
      youtube_trends: ytTrends.length,
    };

    let robloxTotalCCU = 0;

    for (const g of allGames) {
      if (g.platform === 'roblox') {
        robloxTotalCCU += g.metricValue;
      }

      if (!archetypeStats.has(g.archetype)) {
        archetypeStats.set(g.archetype, {
          totalCCU: 0,
          titles: [],
          count: 0,
          hasUpAndComing: false,
        });
      }

      const stat = archetypeStats.get(g.archetype)!;
      stat.count++;
      if (g.metricType === 'ccu') {
        stat.totalCCU += g.metricValue;
      }
      if (!stat.titles.includes(g.title)) {
        stat.titles.push(g.title);
      }
      if (g.tags.includes('up-and-coming') || g.tags.includes('viral')) {
        stat.hasUpAndComing = true;
      }
    }

    // Arbitrage detection: Roblox hits (CCU > 100k) missing in Yandex Games catalog
    const arbitrageOpportunities = arbitrageAnalyzer.findOpportunities(robloxGames, yandexGames);
    const arbitrageArchetypes = new Set(arbitrageOpportunities.map(o => o.archetype));

    if (arbitrageOpportunities.length > 0) {
      log(`\n🎯 Найдено арбитражных ниш: ${arbitrageOpportunities.length} (Roblox CCU > 100k без аналогов на Яндекс Играх)`);
    }

    // Calculate verdicts
    const verdicts = Array.from(archetypeStats.entries()).map(([archetype, stat]) => {
      const marketSharePercent = robloxTotalCCU > 0 ? Math.round((stat.totalCCU / robloxTotalCCU) * 100) : 0;
      const viralMultiplier = youtubeAnalyzer.calculateViralMultiplier(archetype, detectedMemes);
      const score = scorer.calculateScore(archetype, stat.totalCCU, stat.count, stat.hasUpAndComing, viralMultiplier);
      const verdict = verdictEngine.generateVerdict(archetype, score, stat.totalCCU, marketSharePercent, stat.titles);
      if (arbitrageArchetypes.has(archetype)) {
        verdict.hasArbitrageOpportunity = true;
      }
      return verdict;
    });

    // Sort verdicts by overall score descending
    verdicts.sort((a, b) => b.opportunityScore.overallScore - a.opportunityScore.overallScore);

    const dateStr = startTime.split('T')[0];
    const snapshotId = this.options.snapshotId ?? `snapshot-${dateStr}`;

    const snapshot: MarketSnapshot = {
      id: snapshotId,
      timestamp: startTime,
      totalGamesScanned: allGames.length,
      platformCounts,
      robloxTotalCCU,
      games: allGames,
      verdicts,
      arbitrageOpportunities,
    };

    const savedJsonPath = store.saveSnapshot(snapshot);
    const savedReportPath = store.generateMarkdownReport(snapshot);

    log(`💾 Снимок рынка сохранен: ${savedJsonPath}`);
    log(`📄 Отчет Markdown сохранен: ${savedReportPath}\n`);

    const completedPayload: ScanCompletedEvent = {
      snapshotId: snapshot.id,
      totalGames: snapshot.totalGamesScanned,
      timestamp: snapshot.timestamp,
    };

    this.emit('scan:completed', completedPayload);
    this.eventBus?.broadcast('scan:completed', completedPayload);
    this.eventBus?.broadcast('snapshot:updated', { snapshotId: snapshot.id });

    return snapshot;
  }
}

export async function runMarketScan(options: MarketScannerOptions = {}): Promise<MarketSnapshot> {
  const scanner = new MarketScanner(options);
  return scanner.scan();
}
