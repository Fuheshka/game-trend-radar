import { runMarketScan } from './scanner.js';
import { SnapshotStore } from './storage/snapshot_store.js';
import { MarketSnapshot } from './types/index.js';

async function runScan() {
  const store = new SnapshotStore();
  const snapshot = await runMarketScan({ store });
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
