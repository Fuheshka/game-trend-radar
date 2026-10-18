/**
 * Поиск по дашборду: популярные теги-чипы и сопоставление запроса с вердиктами и играми.
 * Чистые функции без DOM — App хранит строку запроса и вызывает их.
 */
import { GameArchetype, MarketSnapshot, MarketVerdict, NormalizedGame } from '../types.js';

export interface PopularSearchTag {
  id: string;
  label: string;
  query: string;
}

export const POPULAR_SEARCH_TAGS: PopularSearchTag[] = [
  { id: 'simulators', label: 'Симуляторы', query: 'симулятор' },
  { id: 'horror', label: 'Хоррор', query: 'хоррор' },
  { id: 'obby', label: 'Обби', query: 'обби' },
  { id: 'puzzles', label: 'Головоломки', query: 'головоломк' },
  { id: 'sandbox', label: 'Песочница', query: 'песочниц' },
  { id: 'clickers', label: 'Кликеры', query: 'кликер' },
  { id: 'shorts', label: 'Мемы Shorts', query: 'shorts' },
  { id: 'merge', label: 'Мёрдж', query: 'мёрдж' },
  { id: 'shooters', label: 'Шутеры', query: 'шутер' },
  { id: 'tycoons', label: 'Тайкуны', query: 'тайкун' },
  { id: 'ragdoll', label: 'Рэгдолл', query: 'рэгдолл' },
];

/** Активен ли тег при текущем запросе (запрос совпадает с тегом или является его частью). */
export function isTagActive(tag: PopularSearchTag, searchQuery: string): boolean {
  if (!searchQuery) return false;
  const q = searchQuery.toLowerCase().trim();
  const tQuery = tag.query.toLowerCase();
  const tLabel = tag.label.toLowerCase();
  return q === tQuery || q === tLabel || tLabel.includes(q) || tQuery.includes(q) || q.includes(tQuery);
}

export function countGamesForTag(tag: PopularSearchTag, snapshot: MarketSnapshot): number {
  const q = tag.query.toLowerCase();
  const label = tag.label.toLowerCase();
  const games = snapshot.games || [];
  let count = 0;

  for (const g of games) {
    const inTitle = g.title.toLowerCase().includes(q) || g.title.toLowerCase().includes(label);
    const inGenre = (g.genre && (g.genre.toLowerCase().includes(q) || g.genre.toLowerCase().includes(label))) || false;
    const inTags = (g.tags || []).some(t => t.toLowerCase().includes(q) || t.toLowerCase().includes(label));

    let inArch = false;
    if (q === 'симулятор' || q === 'кликер') inArch = g.archetype === 'SIMULATION_INCREMENTAL';
    else if (q === 'хоррор') inArch = g.archetype === 'SURVIVAL_HORROR';
    else if (q === 'обби') inArch = g.archetype === 'OBBY_PARKOUR';
    else if (q === 'головоломк') inArch = g.archetype === 'WORD_PUZZLE';
    else if (q === 'песочниц' || q === 'рэгдолл') inArch = g.archetype === 'PHYSICS_SANDBOX';
    else if (q === 'мёрдж' || q === 'тайкун') inArch = g.archetype === 'MERGE_IDLE';
    else if (q === 'шутер') inArch = g.archetype === 'ACTION_SHOOTER';
    else if (q === 'shorts') inArch = g.platform === 'youtube_trends' || (g.tags && g.tags.some(t => t.toLowerCase().includes('short')));

    if (inTitle || inGenre || inTags || inArch) {
      count++;
    }
  }

  if (count === 0) {
    for (const v of snapshot.verdicts || []) {
      if (verdictMatchesQuery(v, q, snapshot.games || [])) {
        count += Math.max(1, v.sampleTitles.length);
      }
    }
  }

  return count;
}

export function verdictMatchesQuery(v: MarketVerdict, q: string, games: NormalizedGame[]): boolean {
  if (!q) return true;
  const lower = q.toLowerCase().trim();

  // 1. Direct text fields
  if (
    v.titleRu.toLowerCase().includes(lower) ||
    v.archetype.toLowerCase().includes(lower) ||
    v.sampleTitles.some(s => s.toLowerCase().includes(lower)) ||
    v.actionRecommendation.toLowerCase().includes(lower) ||
    v.coreLoopBlueprint.toLowerCase().includes(lower) ||
    v.avoidPitfalls.toLowerCase().includes(lower) ||
    (v.monetizationStrategy && v.monetizationStrategy.toLowerCase().includes(lower))
  ) {
    return true;
  }

  // 2. Archetype keyword mapping (e.g. головоломка -> WORD_PUZZLE, песочница -> PHYSICS_SANDBOX, кликер -> SIMULATION_INCREMENTAL)
  const keywords: Record<GameArchetype, string[]> = {
    SIMULATION_INCREMENTAL: ['симулятор', 'симуляторы', 'эволюция', 'кликер', 'кликеры', 'тайкун', 'тайкуны', 'добыча', 'прокачка'],
    PHYSICS_SANDBOX: ['песочница', 'песочницы', 'сендбокс', 'sandbox', 'рэгдолл', 'ragdoll', 'физика', 'разрушение', 'melon'],
    MERGE_IDLE: ['мёрдж', 'мердж', 'merge', 'сортировка', 'айдл', 'idle', 'тайкун', 'крафт'],
    SURVIVAL_HORROR: ['хоррор', 'хорроры', 'horror', 'побег', 'выживание', 'survival', 'escape', 'doors', 'фредди', 'fnaf'],
    WORD_PUZZLE: ['головоломка', 'головоломки', 'пазл', 'пазлы', 'puzzle', 'слова', 'словесные', 'филворд', 'кроссворд', 'логика', 'викторина'],
    ACTION_SHOOTER: ['шутер', 'шутеры', 'shooter', 'экшен', 'action', 'стрелялка', 'стрелялки', 'оружие', 'standoff'],
    OBBY_PARKOUR: ['обби', 'паркур', 'obby', 'parkour', 'башня', 'прыжки', 'tower'],
    OTHER_CASUAL: ['казуальные', 'casual', 'аркады', 'arcade'],
  };

  const archKeywords = keywords[v.archetype] || [];
  if (archKeywords.some(k => k.includes(lower) || lower.includes(k))) {
    return true;
  }

  // 3. YouTube Shorts / viral meme search
  if (lower.includes('мем') || lower.includes('short') || lower.includes('viral') || lower.includes('вирус')) {
    if (v.opportunityScore?.viralMultiplier && v.opportunityScore.viralMultiplier > 1.0) {
      return true;
    }
    if (
      v.sampleTitles.some(s =>
        s.toLowerCase().includes('brainrot') ||
        s.toLowerCase().includes('egg') ||
        s.toLowerCase().includes('skibidi') ||
        s.toLowerCase().includes('shorts')
      )
    ) {
      return true;
    }
  }

  // 4. Any associated games in this snapshot
  const matchingGames = games.some(
    g =>
      g.archetype === v.archetype &&
      (g.title.toLowerCase().includes(lower) ||
        (g.genre && g.genre.toLowerCase().includes(lower)) ||
        (g.tags && g.tags.some(t => t.toLowerCase().includes(lower))))
  );
  if (matchingGames) {
    return true;
  }

  return false;
}
