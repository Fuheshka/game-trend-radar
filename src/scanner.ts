import { RobloxCollector } from './collectors/roblox.js';
import { YandexGamesCollector } from './collectors/yandex_games.js';
import { PokiCollector } from './collectors/poki.js';
import { YouTubeShortsAnalyzer } from './collectors/youtube_shorts.js';
import { OpportunityScorer } from './analyzer/scorer.js';
import { VerdictEngine } from './analyzer/verdict.js';
import { ArbitrageAnalyzer } from './analyzer/arbitrage.js';
import { SnapshotStore } from './storage/snapshot_store.js';
import { GameArchetype, MarketSnapshot, NormalizedGame, PlatformType } from './types/index.js';
import { randomUUID } from 'node:crypto';

export interface ScanOptions {
  store?: SnapshotStore;
  silent?: boolean;
}

export async function runMarketScan(options: ScanOptions = {}): Promise<MarketSnapshot> {
  const log = options.silent ? () => {} : console.log;

  log('\n======================================================');
  log('📡 GAME TREND RADAR | Сбор и анализ игрового рынка');
  log('======================================================\n');

  const robloxCollector = new RobloxCollector();
  const yandexCollector = new YandexGamesCollector();
  const pokiCollector = new PokiCollector();
  const youtubeAnalyzer = new YouTubeShortsAnalyzer();
  const scorer = new OpportunityScorer();
  const verdictEngine = new VerdictEngine();
  const arbitrageAnalyzer = new ArbitrageAnalyzer();
  const store = options.store || new SnapshotStore();

  log('⏳ Опрос витрин данных...');

  const [robloxGames, yandexGames, pokiGames, ytTrends, shortsVideos] = await Promise.all([
    robloxCollector.fetchAllKeySorts().then(res => {
      log(`  [+] Roblox: получено ${res.length} игр из ключевых чартов`);
      return res;
    }),
    yandexCollector.fetchCatalog().then(res => {
      log(`  [+] Яндекс Игры: получено ${res.length} карточек каталога`);
      return res;
    }),
    pokiCollector.fetchPopular().then(res => {
      log(`  [+] Poki: получено ${res.length} популярных веб-игр`);
      return res;
    }),
    youtubeAnalyzer.getViralShortsTrends().then(res => {
      log(`  [+] YouTube Shorts: получено ${res.length} вирусных позиций`);
      return res;
    }),
    youtubeAnalyzer.scanTrendingSlices(['#shorts', '#roblox', '#gamedev']).then(res => {
      return res;
    }),
  ]);

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

  const snapshot: MarketSnapshot = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
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

  return snapshot;
}
