import { EventEmitter } from 'node:events';
import { RobloxCollector } from './collectors/roblox.js';
import { YandexGamesCollector } from './collectors/yandex_games.js';
import { PokiCollector } from './collectors/poki.js';
import { YouTubeShortsAnalyzer } from './collectors/youtube_shorts.js';
import { OpportunityScorer } from './analyzer/scorer.js';
import { VerdictEngine } from './analyzer/verdict.js';
import { ArbitrageAnalyzer } from './analyzer/arbitrage.js';
import { SnapshotStore } from './storage/snapshot_store.js';
import {
  DetectedMemeTrend,
  GameArchetype,
  MarketSnapshot,
  NormalizedGame,
  PlatformType,
  ShortsVideoItem,
  SourceStatus,
} from './types/index.js';
import { MarketEventBus } from './events/event_bus.js';

export type CollectorSource = 'roblox' | 'yandex_games' | 'poki' | 'youtube_shorts';

export interface CollectorProgressEvent {
  source: CollectorSource;
  count: number;
  pct: number;
}

export type { SourceStatus };

export const MIN_TOTAL_GAMES = 5;

/** Минимум игр с витрины, ниже которого сбор считается неполным (типичный объём: Roblox ~280, Яндекс ~150, Poki 100). */
export const SOURCE_MIN_COUNT: Partial<Record<CollectorSource, number>> = { roblox: 50, yandex_games: 50, poki: 30 };
/** Падение ниже этой доли от последнего здорового скана — предупреждение. YouTube не проверяется: 5±3 позиций — норма. */
export const SOURCE_DROP_RATIO = 0.5;

/**
 * Парсеры витрин при смене вёрстки не падают, а тихо собирают меньше игр.
 * Сравнивает count с минимумом и с базой — count последнего здорового скана. База переносится
 * через деградировавшие сканы, поэтому предупреждение держится до восстановления, а не один скан.
 */
export function assessSourceHealth(
  source: CollectorSource,
  status: SourceStatus,
  previous?: SourceStatus
): SourceStatus {
  const min = SOURCE_MIN_COUNT[source];
  if (min === undefined) return status;
  const baseline = previous ? (previous.ok && !previous.warning ? previous.count : previous.baseline) : undefined;
  let warning: string | undefined;
  if (status.ok && status.count < min) {
    warning = `собрано ${status.count} игр, ожидается не меньше ${min}`;
  } else if (status.ok && baseline && status.count < baseline * SOURCE_DROP_RATIO) {
    const drop = Math.round((1 - status.count / baseline) * 100);
    warning = `собрано ${status.count} игр против ${baseline} в последнем полном скане (−${drop}%)`;
  }
  const healthy = status.ok && !warning;
  return { ...status, ...(warning ? { warning } : {}), ...(!healthy && baseline ? { baseline } : {}) };
}

export class ScanValidationError extends Error {
  constructor(message: string, public readonly sourceStatus: Record<string, SourceStatus>) {
    super(message);
    this.name = 'ScanValidationError';
  }
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
    scanTrendingSlices: (tags: string[]) => Promise<ShortsVideoItem[]>;
    detectViralMemes: (videos: ShortsVideoItem[]) => DetectedMemeTrend[];
    calculateViralMultiplier: (archetype: GameArchetype, memes: DetectedMemeTrend[]) => number;
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

    // Статусы прошлого скана — база для детекта тихой деградации парсеров
    let previousStatus: Record<string, SourceStatus> | undefined;
    try {
      previousStatus = store.getLatestSnapshot()?.sourceStatus;
    } catch {
      // битый прошлый снимок не мешает сканировать; сравнение просто пропускаем
    }

    // Все витрины стартуют параллельно; прогресс публикуется в фиксированном порядке.
    const sourceStatus = {} as Record<CollectorSource, SourceStatus>;
    const record = (source: CollectorSource, status: SourceStatus): void => {
      sourceStatus[source] = assessSourceHealth(source, status, previousStatus?.[source]);
      const warning = sourceStatus[source].warning;
      if (warning) log(`  [!] ${source}: неполный сбор — ${warning}`);
    };
    const settle = <T>(source: CollectorSource, work: () => Promise<T[]>): Promise<T[]> =>
      Promise.resolve()
        .then(work)
        .then(items => {
          record(source, { ok: items.length > 0, count: items.length });
          return items;
        })
        .catch((err: unknown) => {
          const error = err instanceof Error ? err.message : String(err);
          record(source, { ok: false, count: 0, error });
          log(`  [!] ${source}: ошибка сбора — ${error}`);
          return [] as T[];
        });

    const robloxP = settle('roblox', () => robloxCollector.fetchAllKeySorts());
    const yandexP = settle('yandex_games', () => yandexCollector.fetchCatalog());
    const pokiP = settle('poki', () => pokiCollector.fetchPopular());
    const youtubeP = Promise.all([
      settle('youtube_shorts', () => youtubeAnalyzer.getViralShortsTrends()),
      Promise.resolve()
        .then(() => youtubeAnalyzer.scanTrendingSlices(['#shorts', '#roblox', '#gamedev']))
        .catch((): ShortsVideoItem[] => []),
    ]);

    // 1. Roblox (pct: 25)
    const robloxGames = await robloxP;
    log(`  [+] Roblox: получено ${robloxGames.length} игр из ключевых чартов`);
    let cumulativeCount = robloxGames.length;
    this.emitProgress('roblox', cumulativeCount, 25);

    // 2. Яндекс Игры (pct: 55)
    const yandexGames = await yandexP;
    log(`  [+] Яндекс Игры: получено ${yandexGames.length} карточек каталога`);
    cumulativeCount += yandexGames.length;
    this.emitProgress('yandex_games', cumulativeCount, 55);

    // 3. Poki (pct: 75)
    const pokiGames = await pokiP;
    log(`  [+] Poki: получено ${pokiGames.length} популярных веб-игр`);
    cumulativeCount += pokiGames.length;
    this.emitProgress('poki', cumulativeCount, 75);

    // 4. YouTube Shorts (pct: 90)
    const [ytTrends, shortsVideos] = await youtubeP;
    log(`  [+] YouTube Shorts: получено ${ytTrends.length} вирусных позиций`);
    cumulativeCount += ytTrends.length;
    this.emitProgress('youtube_shorts', cumulativeCount, 90);

    // Валидация: пустой Roblox (ядро метрик) = сбой API, такой снимок хуже, чем его отсутствие.
    if (robloxGames.length === 0 || cumulativeCount < MIN_TOTAL_GAMES) {
      const reason =
        robloxGames.length === 0
          ? 'Roblox вернул 0 игр'
          : `собрано всего ${cumulativeCount} игр (минимум ${MIN_TOTAL_GAMES})`;
      const failure = new ScanValidationError(`Скан отклонён: ${reason}. Снимок не сохранён.`, sourceStatus);
      this.emit('scan:failed', { error: failure.message, sourceStatus });
      this.eventBus?.broadcast('scan:failed', { error: failure.message, sourceStatus });
      throw failure;
    }

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
      sourceStatus,
    };

    try {
      Object.assign(snapshot, store.updateGameHistory(snapshot));
      log(`🆕 Новинок: ${snapshot.newEntries?.length ?? 0}, 📈 растущих: ${snapshot.risers?.length ?? 0}`);
    } catch (err) {
      // История вспомогательная: без неё снимок всё равно сохраняем
      log(`⚠️ История по играм не обновлена: ${err instanceof Error ? err.message : String(err)}`);
    }

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
