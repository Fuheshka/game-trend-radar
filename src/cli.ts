import { RobloxCollector } from './collectors/roblox.js';
import { YandexGamesCollector } from './collectors/yandex_games.js';
import { PokiCollector } from './collectors/poki.js';
import { YouTubeShortsAnalyzer } from './collectors/youtube_shorts.js';
import { OpportunityScorer } from './analyzer/scorer.js';
import { VerdictEngine } from './analyzer/verdict.js';
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
  const store = new SnapshotStore();

  console.log('⏳ Опрос витрин данных...');

  const [robloxGames, yandexGames, pokiGames, ytTrends] = await Promise.all([
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
      console.log(`  [+] YouTube Shorts: получено ${res.length} вирусных тем`);
      return res;
    }),
  ]);

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

  // Calculate verdicts
  const verdicts = Array.from(archetypeStats.entries()).map(([archetype, stat]) => {
    const marketSharePercent = robloxTotalCCU > 0 ? Math.round((stat.totalCCU / robloxTotalCCU) * 100) : 0;
    const score = scorer.calculateScore(archetype, stat.totalCCU, stat.count, stat.hasUpAndComing);
    return verdictEngine.generateVerdict(archetype, score, stat.totalCCU, marketSharePercent, stat.titles);
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
  };

  const savedJsonPath = store.saveSnapshot(snapshot);
  const savedReportPath = store.generateMarkdownReport(snapshot);

  console.log(`💾 Снимок рынка сохранен: ${savedJsonPath}`);
  console.log(`📄 Отчет Markdown сохранен: ${savedReportPath}\n`);

  printRecommendations(snapshot);
}

function printRecommendations(snapshot: MarketSnapshot) {
  console.log('------------------------------------------------------');
  console.log('🏆 ТОП РЕКОМЕНДАЦИЙ: ВО ЧТО ИГРАЮТ И ЧТО СТОИТ ДЕЛАТЬ');
  console.log('------------------------------------------------------\n');

  for (const v of snapshot.verdicts) {
    const badge = v.status === 'GREEN_LIGHT' ? '🟢 GREEN LIGHT' : v.status === 'YELLOW_LIGHT' ? '🟡 YELLOW LIGHT' : '🔴 RED LIGHT';
    console.log(`[${badge}] ${v.titleRu} (Score: ${v.opportunityScore.overallScore}/100)`);
    console.log(`  - Аудитория (Roblox CCU): ${v.totalAudienceCCU.toLocaleString()} игроков`);
    console.log(`  - Спрос: ${v.opportunityScore.demandScore}/100 | Скорость роста: ${v.opportunityScore.velocityScore}/100`);
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
