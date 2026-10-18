import { MarketSnapshot, NormalizedGame } from '../../types.js';
import { BreakoutItem, GainerItem, GainersSortMode, ViralSignalItem } from './types.js';
import { generateMoversSparkline } from './sparkline.js';

/**
 * Расчет и ранжирование суточных лидеров роста CCU (24h Gainers)
 */
export function calculate24hGainers(
  currentSnapshot?: MarketSnapshot | null,
  previousSnapshot?: MarketSnapshot | null,
  sortMode: GainersSortMode = 'abs'
): GainerItem[] {
  if (!currentSnapshot || !currentSnapshot.games) return [];

  const prevGamesMap = new Map<string, NormalizedGame>();
  if (previousSnapshot && previousSnapshot.games) {
    for (const g of previousSnapshot.games) {
      prevGamesMap.set(g.id, g);
      prevGamesMap.set(`${g.platform}:${g.title.toLowerCase().trim()}`, g);
    }
  }

  const items: GainerItem[] = [];

  for (const game of currentSnapshot.games) {
    if (game.metricType !== 'ccu') continue;

    const prev = prevGamesMap.get(game.id) || prevGamesMap.get(`${game.platform}:${game.title.toLowerCase().trim()}`);
    let prevCcu: number;
    let absDiff: number;
    let pctDiff: number;

    if (prev && typeof prev.metricValue === 'number') {
      prevCcu = prev.metricValue;
      absDiff = game.metricValue - prevCcu;
      pctDiff = prevCcu > 0 ? (absDiff / prevCcu) * 100 : (absDiff > 0 ? 100 : 0);
    } else if (previousSnapshot) {
      // Игры не было в предыдущем срезе — новый участник
      prevCcu = 0;
      absDiff = game.metricValue;
      pctDiff = 100;
    } else {
      // Фолбэк при отсутствии previousSnapshot
      const spark = generateMoversSparkline(game);
      pctDiff = Math.max(5, spark.deltaPercent);
      prevCcu = Math.max(1, Math.round(game.metricValue / (1 + pctDiff / 100)));
      absDiff = game.metricValue - prevCcu;
    }

    if (absDiff > 0) {
      items.push({
        game,
        rank: 0,
        currentCcu: game.metricValue,
        prevCcu,
        absDiff,
        pctDiff: Number(pctDiff.toFixed(2)),
        sparkline: generateMoversSparkline(game),
      });
    }
  }

  if (sortMode === 'pct') {
    items.sort((a, b) => b.pctDiff - a.pctDiff || b.absDiff - a.absDiff);
  } else {
    items.sort((a, b) => b.absDiff - a.absDiff || b.pctDiff - a.pctDiff);
  }

  items.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return items;
}

/**
 * Фильтрация вирусных сигналов YouTube Shorts с множителем >= minMultiplier (1.5x)
 */
export function filterViralSignals(
  currentSnapshot?: MarketSnapshot | null,
  minMultiplier = 1.5
): ViralSignalItem[] {
  if (!currentSnapshot) return [];

  const results: ViralSignalItem[] = [];
  const seenArchetypes = new Set<string>();

  // 1. Из вердиктов снимка
  if (currentSnapshot.verdicts) {
    for (const v of currentSnapshot.verdicts) {
      const vm = v.opportunityScore?.viralMultiplier ?? 1.0;
      if (vm >= minMultiplier) {
        let associatedGame: NormalizedGame | undefined;
        if (v.sampleTitles && v.sampleTitles.length > 0) {
          const sample = v.sampleTitles[0];
          associatedGame = currentSnapshot.games?.find(
            g => g.title === sample || g.title.toLowerCase().includes(sample.toLowerCase())
          );
        }
        if (!associatedGame && currentSnapshot.games) {
          associatedGame = currentSnapshot.games.find(g => g.archetype === v.archetype);
        }

        const trendTitle = v.sampleTitles && v.sampleTitles.length > 0
          ? v.sampleTitles.slice(0, 2).join(' / ')
          : v.titleRu;

        const sparkline = generateMoversSparkline(
          associatedGame || [50, 70, 95, 130, 180, 240]
        );

        results.push({
          id: `viral_${v.archetype}`,
          trendTitle,
          viralMultiplier: vm,
          archetype: v.archetype,
          metricValue: Math.round(vm * 50),
          sampleTitles: v.sampleTitles || [],
          sparkline,
          associatedGame,
          verdict: v,
        });
        seenArchetypes.add(v.archetype);
      }
    }
  }

  // 2. Из карточек YouTube Trends / вирусных тегов
  if (currentSnapshot.games) {
    const ytGames = currentSnapshot.games.filter(
      g => g.platform === 'youtube_trends' || (g.tags && g.tags.includes('viral'))
    );
    for (const g of ytGames) {
      const alreadyAdded = results.some(r => r.associatedGame?.id === g.id || r.trendTitle === g.title);
      if (!alreadyAdded && !seenArchetypes.has(g.archetype)) {
        const verdict = currentSnapshot.verdicts?.find(v => v.archetype === g.archetype);
        const vm = verdict?.opportunityScore?.viralMultiplier ?? (g.tags?.includes('viral') ? 1.75 : 1.0);
        if (vm >= minMultiplier) {
          results.push({
            id: `viral_${g.id}`,
            trendTitle: g.title,
            viralMultiplier: vm,
            archetype: g.archetype,
            metricValue: g.metricValue,
            sampleTitles: [g.title],
            sparkline: generateMoversSparkline(g),
            associatedGame: g,
          });
          seenArchetypes.add(g.archetype);
        }
      }
    }
  }

  results.sort((a, b) => b.viralMultiplier - a.viralMultiplier);
  return results;
}

/**
 * Фильтрация молодых взрывных релизов (< 14 дней на платформе)
 */
export function filterBreakoutNewReleases(
  currentSnapshot?: MarketSnapshot | null,
  maxAgeDays = 14
): BreakoutItem[] {
  if (!currentSnapshot || !currentSnapshot.games) return [];

  const now = currentSnapshot.timestamp ? new Date(currentSnapshot.timestamp).getTime() : Date.now();
  const msInDay = 86400000;

  const items: BreakoutItem[] = [];

  for (const game of currentSnapshot.games) {
    if (game.metricType !== 'ccu') continue;

    const tags = game.tags || [];
    const isUpAndComing = game.sortSource === 'up-and-coming' || tags.includes('up-and-coming');
    const isNewTagged = tags.includes('new') || tags.includes('breakout') || tags.includes('fresh');
    const hasAlphaBeta = /\[(alpha|beta|new|upd|release)\]/i.test(game.title);

    let ageDays = 7;
    let hasTimestamp = false;
    if (game.timestamp) {
      const gameTime = new Date(game.timestamp).getTime();
      if (!Number.isNaN(gameTime)) {
        ageDays = Math.max(1, Math.round((now - gameTime) / msInDay));
        hasTimestamp = true;
      }
    }

    const isYoung = ageDays <= maxAgeDays;
    const isCandidate = isUpAndComing || isNewTagged || hasAlphaBeta;

    // Включаем, если игра имеет маркер новичка и молода, или строго подтверждена по дате
    if ((isCandidate && isYoung) || (hasTimestamp && isYoung && isCandidate)) {
      items.push({
        game,
        rank: 0,
        ccu: game.metricValue,
        ageDays,
        growthBadge: ageDays <= 3 ? '< 3 дней' : `${ageDays} дн. на витрине`,
        sparkline: generateMoversSparkline(game),
      });
    }
  }

  items.sort((a, b) => b.ccu - a.ccu);
  items.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return items;
}

/** Лидеры роста из истории по играм (окно 7 дней, только CCU). null — в снимке истории нет. */
export function gainersFromRisers(snapshot?: MarketSnapshot | null, sortMode: GainersSortMode = 'abs'): GainerItem[] | null {
  if (!snapshot?.risers) return null;
  const byId = new Map(snapshot.games.map(g => [g.id, g]));
  const items: GainerItem[] = [];
  for (const r of snapshot.risers) {
    const game = byId.get(r.id);
    if (r.signal !== 'ccu' || !game) continue;
    items.push({
      game,
      rank: 0,
      currentCcu: r.to,
      prevCcu: r.from,
      absDiff: r.to - r.from,
      pctDiff: r.growthPct,
      sparkline: generateMoversSparkline(game),
    });
  }
  items.sort((a, b) => (sortMode === 'pct' ? b.pctDiff - a.pctDiff : b.absDiff - a.absDiff));
  items.forEach((item, idx) => (item.rank = idx + 1));
  return items;
}

/** Новинки выдачи всех платформ из истории по играм. null — в снимке истории нет. */
export function breakoutsFromNewEntries(snapshot?: MarketSnapshot | null): BreakoutItem[] | null {
  if (!snapshot?.newEntries) return null;
  const byId = new Map(snapshot.games.map(g => [g.id, g]));
  const items: BreakoutItem[] = [];
  for (const e of snapshot.newEntries) {
    const game = byId.get(e.id);
    if (!game) continue;
    items.push({
      game,
      rank: items.length + 1,
      ccu: e.metricValue,
      ageDays: e.ageDays,
      growthBadge: e.ageDays === 0 ? 'новинка сегодня' : `${e.ageDays} дн. в выдаче`,
      sparkline: generateMoversSparkline(game),
    });
  }
  return items;
}
