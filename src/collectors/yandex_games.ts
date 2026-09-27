import { NormalizedGame } from '../types/index.js';
import { classifyArchetype } from '../analyzer/classifier.js';

export class YandexGamesCollector {
  private userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  async fetchCatalog(): Promise<NormalizedGame[]> {
    const categories = [
      '',
      'category/new',
      'category/puzzles',
      'category/simulator',
      'category/arcade',
      'category/casual',
      'category/match3',
    ];
    const games: NormalizedGame[] = [];
    const seenIds = new Set<string>();
    const now = new Date().toISOString();

    for (const cat of categories) {
      const url = cat ? `https://yandex.ru/games/${cat}` : 'https://yandex.ru/games/';
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept-Language': 'ru,en;q=0.9',
          },
        });

        if (!response.ok) continue;

        const html = await response.text();

        // 1. JSON-LD items (VideoGame objects)
        const jsonLdRegex = /"name"\s*:\s*"([^"]+)"\s*,\s*"url"\s*:\s*"(https:\/\/yandex\.ru\/games\/app\/[^"]+)"/g;
        let jsonMatch: RegExpExecArray | null;
        while ((jsonMatch = jsonLdRegex.exec(html)) !== null) {
          const cleanTitle = jsonMatch[1].trim();
          const fullUrl = jsonMatch[2];
          const idMatch = fullUrl.match(/\/app\/(?:.*-)?(\d+)/);
          if (!idMatch) continue;

          const appId = idMatch[1];
          if (seenIds.has(appId)) continue;
          seenIds.add(appId);

          const archetype = classifyArchetype(cleanTitle, 'YandexWebGame', []);
          games.push({
            id: `yandex_${appId}`,
            platform: 'yandex_games',
            title: cleanTitle,
            genre: 'Web Casual',
            archetype,
            metricValue: 75,
            metricType: 'rating',
            url: fullUrl.split('#')[0].split('?')[0],
            tags: ['yandex_catalog', 'webgl'],
            timestamp: now,
          });
        }

        // 2. Extract game links and titles (both relative and absolute)
        const linkRegex = /<a [^>]*href=["'](?:https:\/\/yandex\.ru)?(\/games\/app\/[^"']+)["'][^>]*>(.*?)<\/a>/gs;
        let match: RegExpExecArray | null;

        while ((match = linkRegex.exec(html)) !== null) {
          const pathPart = match[1];
          const innerHtml = match[2];
          const fullUrl = `https://yandex.ru${pathPart}`;

          // Extract ID from URL
          const idMatch = fullUrl.match(/\/app\/(?:.*-)?(\d+)/);
          if (!idMatch) continue;

          const appId = idMatch[1];
          if (seenIds.has(appId)) continue;

          // Clean text content (or check for title/alt attribute)
          let cleanTitle = innerHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (!cleanTitle || cleanTitle.length < 2) {
            const titleAttrMatch = match[0].match(/title=["']([^"']+)["']/);
            if (titleAttrMatch) {
              cleanTitle = titleAttrMatch[1].trim();
            } else {
              const altAttrMatch = match[0].match(/alt=["']([^"']+)["']/);
              if (altAttrMatch) {
                cleanTitle = altAttrMatch[1].trim();
              }
            }
          }
          if (!cleanTitle || cleanTitle.length < 2) continue;

          seenIds.add(appId);

          // Extract rating if present near the card or assign estimated baseline
          let rating = 70; // baseline default
          const ratingMatch = html.slice(Math.max(0, match.index - 300), match.index + 300).match(/(\d{2,3})\s*(?:%|рейтинг)/i);
          if (ratingMatch) {
            const parsed = parseInt(ratingMatch[1], 10);
            if (parsed >= 10 && parsed <= 100) rating = parsed;
          }

          const archetype = classifyArchetype(cleanTitle, 'YandexWebGame', []);

          games.push({
            id: `yandex_${appId}`,
            platform: 'yandex_games',
            title: cleanTitle,
            genre: 'Web Casual',
            archetype,
            metricValue: rating,
            metricType: 'rating',
            url: fullUrl.split('#')[0].split('?')[0],
            tags: ['yandex_catalog', 'webgl'],
            timestamp: now,
          });
        }
      } catch (err) {
        console.warn(`[YandexGamesCollector] Error fetching ${url}:`, err);
      }
    }

    return games;
  }
}
