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

async function runScan() {
  console.log('\n======================================================');
  console.log('📡 GAME TREND RADAR | Сбор и анализ игрового рынка');
  console.log('======================================================\n');

  const robloxCollector = new RobloxCollector();
  const yandexCollector = new YandexGamesCollector();
  const pokiCollector = new PokiCollector();
  const youtubeAnalyzer = new YouTubeShortsAnalyzer();
  const scorer = new OpportunityScorer();
  const verdictEngine = new VerdictEngine();
  const arbitrageAnalyzer = new ArbitrageAnalyzer();
  const store = new SnapshotStore();

  console.log('⏳ Опрос витрин данных...');

  const [robloxGames, yandexGames, pokiGames, ytTrends, shortsVideos] = await Promise.all([
    robloxCollector.fetchAllKeySorts().then(res => {
      console.log(`  [+] Roblox: получено ${res.length} игр из ключевых чартов`);
      return res;
    }),
    yandexCollector.fetchCatalog().then(res => {
      console.log(`  [+] Яндекс Игры: получено ${res.length} карточек каталога`);
      return res;
    }),
    pokiCollector.fetchPopular().then(res => {
      console.log(`  [+] Poki: получено ${res.length} популярных веб-игр`);
      return res;
    }),
    youtubeAnalyzer.getViralShortsTrends().then(res => {
      console.log(`  [+] YouTube Shorts: получено ${res.length} вирусных позиций`);
      return res;
    }),
    youtubeAnalyzer.scanTrendingSlices(['#shorts', '#roblox', '#gamedev']).then(res => {
      return res;
    }),
  ]);

  const detectedMemes = youtubeAnalyzer.detectViralMemes(shortsVideos);
  const activeMemes = detectedMemes.filter(m => m.occurrences > 0);
  if (activeMemes.length > 0) {
    console.log('\n🔥 Детекция вирусных персонажей и мемов (Shorts):');
    for (const m of activeMemes) {
      console.log(`  [🔥] ${m.name}: ${m.occurrences} видео, ~${m.totalViews.toLocaleString()} просмотров (Ускорение: ${m.viralMultiplier}x)`);
    }
  }

  const allGames: NormalizedGame[] = [...robloxGames, ...yandexGames, ...pokiGames, ...ytTrends];
  console.log(`\n📊 Всего собрано: ${allGames.length} игровых позиций`);

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
    console.log(`\n🎯 Найдено арбитражных ниш: ${arbitrageOpportunities.length} (Roblox CCU > 100k без аналогов на Яндекс Играх)`);
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

  console.log(`💾 Снимок рынка сохранен: ${savedJsonPath}`);
  console.log(`📄 Отчет Markdown сохранен: ${savedReportPath}\n`);

  printRecommendations(snapshot);
}

function printRecommendations(snapshot: MarketSnapshot) {
  if (snapshot.arbitrageOpportunities && snapshot.arbitrageOpportunities.length > 0) {
    console.log('------------------------------------------------------');
    console.log('🎯 АРБИТРАЖНЫЕ НИШИ: ХИТ В ROBLOX ➔ ОТСУТСТВУЕТ НА ЯНДЕКС ИГРАХ');
    console.log('------------------------------------------------------\n');

    for (const opp of snapshot.arbitrageOpportunities) {
      console.log(`[🚀 ${opp.badge}] ${opp.robloxGame.title}`);
      console.log(`  - Подтвержденный спрос: ${opp.robloxCCU.toLocaleString()} CCU (Потенциал: ${opp.organicPotential})`);
      const analogText = opp.nearestAnalog
        ? `«${opp.nearestAnalog.title}» (${Math.round(opp.similarityWithNearestAnalog * 100)}%)`
        : 'Отсутствует в каталоге';
      console.log(`  - Ближайший аналог в каталоге: ${analogText}`);
      console.log(`  - Рекомендуемое название для Яндекс Игр: «${opp.suggestedRuTitle}»`);
      console.log(`  - Рецепт адаптации: ${opp.adaptationStrategy}\n`);
    }
  }

  console.log('------------------------------------------------------');
  console.log('🏆 ТОП РЕКОМЕНДАЦИЙ: ВО ЧТО ИГРАЮТ И ЧТО СТОИТ ДЕЛАТЬ');
  console.log('------------------------------------------------------\n');

  for (const v of snapshot.verdicts) {
    const arbitrageTag = v.hasArbitrageOpportunity ? ' [ARBITRAGE OPPORTUNITY]' : '';
    const badge = v.status === 'GREEN_LIGHT' ? '🟢 GREEN LIGHT' : v.status === 'YELLOW_LIGHT' ? '🟡 YELLOW LIGHT' : '🔴 RED LIGHT';
    console.log(`[${badge}] ${v.titleRu}${arbitrageTag} (Score: ${v.opportunityScore.overallScore}/100)`);
    console.log(`  - Аудитория (Roblox CCU): ${v.totalAudienceCCU.toLocaleString()} игроков`);
    const viralInfo = v.opportunityScore.viralMultiplier && v.opportunityScore.viralMultiplier > 1.0 ? ` (Shorts Multiplier: ${v.opportunityScore.viralMultiplier}x)` : '';
    console.log(`  - Спрос: ${v.opportunityScore.demandScore}/100 | Скорость роста: ${v.opportunityScore.velocityScore}/100${viralInfo}`);
    console.log(`  - Насыщенность: ${v.opportunityScore.saturationIndex}/5.0 | Сложность: ${v.opportunityScore.productionEffort}/5.0`);
    console.log(`  - Примеры хитов: ${v.sampleTitles.slice(0, 3).join(', ')}`);
    console.log(`  - Рекомендация: ${v.actionRecommendation}`);
    console.log(`  - Кор-луп: ${v.coreLoopBlueprint}`);
    console.log(`  - Опасность: ${v.avoidPitfalls}\n`);
  }

  console.log('======================================================');
  console.log('Готово! Для полного отчета откройте data/reports/');
  console.log('======================================================\n');
}

async function main() {
  const arg = process.argv[2] || 'scan';
  const store = new SnapshotStore();

  if (arg === 'scan') {
    await runScan();
  } else if (arg === 'report' || arg === 'recommend') {
    const latest = store.getLatestSnapshot();
    if (!latest) {
      console.log('Снимки не найдены. Запускаем первое сканирование...');
      await runScan();
    } else {
      printRecommendations(latest);
    }
  } else {
    console.log('Использование: npm run [scan | report | recommend]');
  }
}

main().catch(err => {
  console.error('Критическая ошибка:', err);
  process.exit(1);
});
