import { fetchWithTimeout } from '../utils/http.js';
import { NormalizedGame } from '../types/index.js';
import { classifyArchetype } from '../analyzer/classifier.js';

export const CRAZYGAMES_HOT_URL = 'https://www.crazygames.com/hot';

/** Метки карточки, которые стоит сохранить в тегах (остальные — служебные hot-desktop/top-rated-*). */
const KEPT_LABELS = new Set(['new', 'updated', 'originals']);

/**
 * Игры из `__NEXT_DATA__` страницы /hot (Next.js): `props.pageProps.games.items` в порядке витрины.
 * Метрика — позиция в списке «Trending»; `totalLikes` идёт в votes как прокси аудитории.
 */
export function parseCrazyGamesNextData(html: string, now: string): NormalizedGame[] {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const items = (data as { props?: { pageProps?: { games?: { items?: unknown } } } })?.props?.pageProps?.games?.items;
  if (!Array.isArray(items)) return [];

  const games: NormalizedGame[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.slug !== 'string' || !/^[\w-]+$/.test(r.slug) || typeof r.name !== 'string') continue;
    const title = r.name.trim();
    if (!title || seen.has(r.slug)) continue;
    const genre = typeof r.categoryName === 'string' && r.categoryName ? r.categoryName : 'Web Arcade';
    seen.add(r.slug);
    const labels = Array.isArray(r.gameThumbLabels)
      ? r.gameThumbLabels.filter((l): l is string => typeof l === 'string' && KEPT_LABELS.has(l))
      : [];
    games.push({
      id: `crazygames_${r.slug}`,
      platform: 'crazygames',
      title,
      genre,
      archetype: classifyArchetype(title, genre, []),
      metricValue: games.length + 1, // Rank index 1..N
      metricType: 'rank',
      votes: typeof r.totalLikes === 'number' && r.totalLikes > 0 ? r.totalLikes : undefined,
      url: `https://www.crazygames.com/game/${r.slug}`,
      tags: ['crazygames_hot', 'html5', ...labels],
      timestamp: now,
    });
  }
  return games;
}

export class CrazyGamesCollector {
  private userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  async fetchHot(): Promise<NormalizedGame[]> {
    try {
      const response = await fetchWithTimeout(CRAZYGAMES_HOT_URL, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!response.ok) {
        throw new Error(`CrazyGames responded with status ${response.status}`);
      }
      return parseCrazyGamesNextData(await response.text(), new Date().toISOString());
    } catch (error) {
      console.error('[CrazyGamesCollector] Error fetching CrazyGames:', error);
      return [];
    }
  }
}
