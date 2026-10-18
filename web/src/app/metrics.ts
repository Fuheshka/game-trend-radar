/**
 * KPI шапки и карточек метрик, посчитанные из снимка рынка (без DOM).
 */
import { MarketSnapshot } from '../types.js';

export interface MarketMetrics {
  totalGames: number;
  totalCcu: number;
  topScore: number;
  /** Название лидирующего вердикта; null — вердиктов нет, текст карточки не трогаем. */
  topGenreTitle: string | null;
  arbitrageCount: number;
  topGameTitle: string;
  ccuChangePercent: number;
  platformsHint: string;
}

/**
 * @param previousSnapshot предыдущий снимок по истории (точная база для изменения CCU)
 * @param previousTotalCcu CCU, показанный до этого обновления — запасная база, если истории нет
 */
export function computeMarketMetrics(
  snapshot: MarketSnapshot,
  previousSnapshot: MarketSnapshot | null,
  previousTotalCcu: number
): MarketMetrics {
  const counts = snapshot.platformCounts;
  const totalGames = snapshot.totalGamesScanned || 0;
  const totalCcu = snapshot.robloxTotalCCU || 0;

  const sortedVerdicts = [...(snapshot.verdicts || [])].sort(
    (a, b) => b.opportunityScore.overallScore - a.opportunityScore.overallScore
  );
  const topScore = sortedVerdicts.length > 0 ? sortedVerdicts[0].opportunityScore.overallScore : 0;

  const arbitrageCount =
    snapshot.arbitrageOpportunities?.length ?? snapshot.verdicts.filter(v => v.hasArbitrageOpportunity).length;

  let topGameTitle = 'Steal An Egg';
  if (snapshot.games && snapshot.games.length > 0) {
    const sortedGames = [...snapshot.games].sort((a, b) => (b.metricValue || 0) - (a.metricValue || 0));
    if (sortedGames[0]) {
      topGameTitle = sortedGames[0].title;
    }
  } else if (sortedVerdicts.length > 0 && sortedVerdicts[0].sampleTitles?.[0]) {
    topGameTitle = sortedVerdicts[0].sampleTitles[0];
  }

  let ccuChangePercent = 0;
  if (previousSnapshot && previousSnapshot.robloxTotalCCU > 0) {
    const delta = totalCcu - previousSnapshot.robloxTotalCCU;
    ccuChangePercent = Number(((delta / previousSnapshot.robloxTotalCCU) * 100).toFixed(1));
  } else if (previousTotalCcu > 0 && totalCcu > 0) {
    const delta = totalCcu - previousTotalCcu;
    ccuChangePercent = Number(((delta / previousTotalCcu) * 100).toFixed(1));
  }

  return {
    totalGames,
    totalCcu,
    topScore,
    topGenreTitle: sortedVerdicts.length > 0 ? sortedVerdicts[0].titleRu : null,
    arbitrageCount,
    topGameTitle,
    ccuChangePercent,
    platformsHint: `Roblox: ${counts.roblox || 0} · Yandex: ${counts.yandex_games || 0} · Poki: ${counts.poki || 0}`,
  };
}
