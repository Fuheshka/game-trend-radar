import { NormalizedGame } from '../types/index.js';
import { classifyArchetype } from '../analyzer/classifier.js';

export class PokiCollector {
  private userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  async fetchPopular(): Promise<NormalizedGame[]> {
    const url = 'https://poki.com/en/popular';
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
        },
      });

      if (!response.ok) {
        throw new Error(`Poki responded with status ${response.status}`);
      }

      const html = await response.text();
      const now = new Date().toISOString();
      const games: NormalizedGame[] = [];
      const seen = new Set<string>();

      // Poki game URLs are structured as /en/g/{game-slug}
      const slugRegex = /\/en\/g\/([a-zA-Z0-9-]+)/g;
      let match: RegExpExecArray | null;
      let rank = 1;

      while ((match = slugRegex.exec(html)) !== null) {
        const slug = match[1];
        if (seen.has(slug) || slug === 'popular' || slug === 'new') continue;
        seen.add(slug);

        // Convert slug to human-readable title
        const title = slug
          .split('-')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');

        const archetype = classifyArchetype(title, 'PokiWebGame', []);

        games.push({
          id: `poki_${slug}`,
          platform: 'poki',
          title,
          genre: 'Web Arcade',
          archetype,
          metricValue: rank, // Rank index 1..N
          metricType: 'rank',
          url: `https://poki.com/en/g/${slug}`,
          tags: ['poki_popular', 'html5'],
          timestamp: now,
        });

        rank++;
        if (games.length >= 100) break;
      }

      return games;
    } catch (error) {
      console.error('[PokiCollector] Error fetching Poki:', error);
      return [];
    }
  }
}
