import { NormalizedGame } from '../../types.js';
import { formatCompactNumber } from '../../utils/format.js';

export function formatMetricVal(game: NormalizedGame): string {
  if (game.metricType === 'ccu') {
    return `${formatCompactNumber(game.metricValue)} CCU`;
  }
  if (game.metricType === 'viral_score') {
    return `${formatCompactNumber(game.metricValue)} pts`;
  }
  if (game.metricType === 'rating') {
    return `${game.metricValue}/100`;
  }
  if (game.metricType === 'rank') {
    return `#${game.metricValue}`;
  }
  return formatCompactNumber(game.metricValue);
}

export function formatLikes(game: NormalizedGame): string {
  if (typeof game.likeRatio === 'number') {
    const pct = game.likeRatio > 1 ? Math.round(game.likeRatio) : Math.round(game.likeRatio * 100);
    return `${pct}%`;
  }
  return '';
}
