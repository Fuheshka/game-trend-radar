import { NormalizedGame } from '../../types.js';
import { SparklineData } from './types.js';

/**
 * Генерирует детерминированный спарклайн для карточки лидера
 */
export function generateMoversSparkline(
  target: NormalizedGame | number[],
  width = 80,
  height = 24,
  pad = 3
): SparklineData {
  let rawPoints: number[] = [];
  let deltaPercent = 25;
  let isPositive = true;

  if (Array.isArray(target)) {
    rawPoints = [...target];
    if (rawPoints.length < 2) {
      rawPoints = [rawPoints[0] || 10, (rawPoints[0] || 10) * 1.2];
    }
    const first = rawPoints[0] || 1;
    const last = rawPoints[rawPoints.length - 1] || 1;
    deltaPercent = Number((((last - first) / Math.max(1, first)) * 100).toFixed(1));
    isPositive = last >= first;
  } else {
    const game = target;
    let hash = 0;
    const str = (game.id || '') + '_' + (game.genre || '') + '_' + (game.platform || '');
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }

    const isTrending = (game.tags || []).some(t =>
      t.includes('trending') || t.includes('viral') || t.includes('top')
    );

    const normalizedHash = Math.abs(hash % 100) / 100;
    deltaPercent = isTrending
      ? Math.round(20 + normalizedHash * 70)
      : Math.round(-15 + normalizedHash * 65);

    isPositive = deltaPercent >= 0;
    const currentVal = Math.max(10, game.metricValue || 100);
    const startVal = Math.max(5, Math.round(currentVal / (1 + deltaPercent / 100)));

    rawPoints = [startVal];
    for (let day = 1; day < 6; day++) {
      const progress = day / 6;
      const fluctuation = ((Math.sin(hash + day * 1.618) + 1) / 2 - 0.5) * 0.14;
      const interpolated = startVal + (currentVal - startVal) * progress;
      rawPoints.push(Math.max(1, Math.round(interpolated * (1 + fluctuation))));
    }
    rawPoints.push(currentVal);
  }

  const min = Math.min(...rawPoints);
  const max = Math.max(...rawPoints);
  const range = max - min || 1;

  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const coords = rawPoints.map((val, idx) => {
    const x = pad + (idx / Math.max(1, rawPoints.length - 1)) * innerW;
    const y = height - pad - ((val - min) / range) * innerH;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  const svgPath = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
  const lastCoord = coords[coords.length - 1] || { x: width - pad, y: height / 2 };

  return {
    points: rawPoints,
    isPositive,
    deltaPercent,
    svgPath,
    endX: lastCoord.x,
    endY: lastCoord.y,
  };
}
