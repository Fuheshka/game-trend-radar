/**
 * Поиск игры для drawer по названию/id и состав игр архетипа (без DOM).
 * Если игры нет в снимке, её карточка синтезируется из вердикта — drawer открывается всегда.
 */
import { MarketSnapshot, NormalizedGame, GameArchetype } from '../types.js';

/** Игра по id или названию: точное совпадение → подстрока → арбитраж → синтез из вердикта. */
export function resolveGame(
  snapshot: MarketSnapshot,
  titleOrId: string,
  archetypeHint?: GameArchetype
): NormalizedGame {
  const games = snapshot.games || [];
  const lower = titleOrId.toLowerCase().trim();

  // 1. Exact ID or Title match
  let found = games.find(g => g.id === titleOrId || g.title.toLowerCase().trim() === lower);

  // 2. Substring match
  if (!found) {
    found = games.find(
      g => g.title.toLowerCase().includes(lower) || lower.includes(g.title.toLowerCase())
    );
  }

  // 3. Arbitrage match
  if (!found && snapshot.arbitrageOpportunities) {
    for (const opp of snapshot.arbitrageOpportunities) {
      if (opp.robloxGame && opp.robloxGame.title.toLowerCase().includes(lower)) {
        found = opp.robloxGame;
        break;
      }
      if (opp.nearestAnalog && opp.nearestAnalog.title.toLowerCase().includes(lower)) {
        found = {
          id: opp.nearestAnalog.id,
          platform: 'yandex_games',
          title: opp.nearestAnalog.title,
          genre: 'Аналог',
          archetype: opp.nearestAnalog.archetype,
          metricValue: Math.round(opp.robloxCCU * 0.15),
          metricType: 'ccu',
          likeRatio: 0.88,
          tags: ['analog', 'arbitrage'],
          timestamp: snapshot.timestamp,
        };
        break;
      }
    }
  }

  // 4. Synthesize game if not explicitly present in snapshot
  if (!found) {
    const arch = archetypeHint || 'OTHER_CASUAL';
    const verdict = (snapshot.verdicts || []).find(v => v.archetype === arch);
    found = {
      id: `synth_${encodeURIComponent(lower)}`,
      platform: 'roblox',
      title: titleOrId,
      genre: verdict ? verdict.titleRu : 'Казуальные',
      archetype: arch,
      metricValue: verdict
        ? Math.round(verdict.totalAudienceCCU / Math.max(1, verdict.sampleTitles.length))
        : 25000,
      metricType: 'ccu',
      likeRatio: 0.92,
      tags: [arch, 'Sample', 'Trending'],
      timestamp: snapshot.timestamp || new Date().toISOString(),
      url: `https://www.roblox.com/discover/?Keyword=${encodeURIComponent(titleOrId)}`,
    };
  }

  return found;
}

/** Игры архетипа из снимка плюс примеры из вердикта (sampleTitles), которых в снимке нет. */
export function getGamesForArchetype(snapshot: MarketSnapshot, archetype: GameArchetype): NormalizedGame[] {
  const games = (snapshot.games || []).filter(g => g.archetype === archetype);
  const verdict = (snapshot.verdicts || []).find(v => v.archetype === archetype);

  if (verdict && verdict.sampleTitles) {
    const existingTitles = new Set(games.map(g => g.title.toLowerCase().trim()));
    for (const sampleTitle of verdict.sampleTitles) {
      if (!sampleTitle || existingTitles.has(sampleTitle.toLowerCase().trim())) continue;
      games.push({
        id: `sample_${sampleTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        platform: 'roblox',
        title: sampleTitle,
        genre: verdict.titleRu,
        archetype: archetype,
        metricValue: Math.round(
          (verdict.totalAudienceCCU || 50000) / Math.max(1, verdict.sampleTitles.length)
        ),
        metricType: 'ccu',
        likeRatio: 0.91,
        url: `https://www.roblox.com/discover/?Keyword=${encodeURIComponent(sampleTitle)}`,
        tags: [archetype, 'Sample', 'Trending'],
        timestamp: snapshot.timestamp || new Date().toISOString(),
      });
      existingTitles.add(sampleTitle.toLowerCase().trim());
    }
  }
  return games;
}
