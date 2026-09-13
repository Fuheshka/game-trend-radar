import { NormalizedGame } from '../types/index.js';
import { classifyArchetype } from '../analyzer/classifier.js';

export class YandexGamesCollector {
  private userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  async fetchCatalog(): Promise<NormalizedGame[]> {
    const url = 'https://yandex.ru/games/';
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Language': 'ru,en;q=0.9',
        },
      });

      if (!response.ok) {
        throw new Error(`Yandex Games responded with status ${response.status}`);
      }

      const html = await response.text();
      const now = new Date().toISOString();
      const games: NormalizedGame[] = [];
      const seenIds = new Set<string>();

      // Extract game links and titles (both relative and absolute)
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
        seenIds.add(appId);

        // Clean text content (or check for title attribute)
        let cleanTitle = innerHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!cleanTitle || cleanTitle.length < 2) {
          const titleAttrMatch = match[0].match(/title=["']([^"']+)["']/);
          if (titleAttrMatch) {
            cleanTitle = titleAttrMatch[1].trim();
          }
        }
        if (!cleanTitle || cleanTitle.length < 2) continue;

        // Extract rating if present near the card or assign estimated baseline
        // In Yandex Games HTML, rating is often formatted as a score out of 100 or 5.0
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

      return games;
    } catch (error) {
      console.error('[YandexGamesCollector] Error fetching catalog:', error);
      return [];
    }
  }
}
