import { NormalizedGame } from '../../types.js';
import type { SparklineData } from './types.js';

/**
 * Deterministically generates a 7-day trend series and SVG path for a game
 */
export function generateGameSparkline(game: NormalizedGame, width = 76, height = 22, pad = 3): SparklineData {
  let hash = 0;
  const str = game.id + '_' + (game.genre || '') + '_' + game.platform;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  const isTrending = (game.tags || []).some(t =>
    t.includes('trending') || t.includes('viral') || t.includes('top')
  );

  const normalizedHash = Math.abs(hash % 100) / 100;
  const deltaPercent = isTrending
    ? Math.round(15 + normalizedHash * 70) // +15% .. +85%
    : Math.round(-28 + normalizedHash * 80); // -28% .. +52%

  const isPositive = deltaPercent >= 0;
  const currentVal = Math.max(10, game.metricValue);
  const startVal = Math.max(5, Math.round(currentVal / (1 + deltaPercent / 100)));

  const rawPoints: number[] = [startVal];
  for (let day = 1; day < 6; day++) {
    const progress = day / 6;
    const fluctuation = ((Math.sin(hash + day * 1.618) + 1) / 2 - 0.5) * 0.16;
    const interpolated = startVal + (currentVal - startVal) * progress;
    rawPoints.push(Math.max(1, Math.round(interpolated * (1 + fluctuation))));
  }
  rawPoints.push(currentVal);

  const min = Math.min(...rawPoints);
  const max = Math.max(...rawPoints);
  const range = max - min || 1;

  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const coords = rawPoints.map((val, idx) => {
    const x = pad + (idx / (rawPoints.length - 1)) * innerW;
    const y = height - pad - ((val - min) / range) * innerH;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  const svgPath = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
  const lastCoord = coords[coords.length - 1];

  return {
    points: rawPoints,
    isPositive,
    deltaPercent,
    svgPath,
    endX: lastCoord.x,
    endY: lastCoord.y,
  };
}
