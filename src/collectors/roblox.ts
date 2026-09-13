import { NormalizedGame, RawRobloxGame } from '../types/index.js';
import { classifyArchetype } from '../analyzer/classifier.js';
import { randomUUID } from 'node:crypto';

export type RobloxSortType = 'top-trending' | 'top-playing-now' | 'up-and-coming' | 'top-revisited';

export class RobloxCollector {
  private sessionId: string;
  private userAgent: string;

  constructor() {
    this.sessionId = randomUUID();
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  async fetchSort(sortId: RobloxSortType = 'top-playing-now'): Promise<NormalizedGame[]> {
    const url = `https://apis.roblox.com/explore-api/v1/get-sort-content?sessionId=${this.sessionId}&sortId=${sortId}`;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Roblox API responded with status ${response.status}`);
      }

      const data = (await response.json()) as { games?: RawRobloxGame[] };
      const rawGames = data.games || [];
      const now = new Date().toISOString();

      return rawGames.map((g): NormalizedGame => {
        const totalVotes = (g.totalUpVotes || 0) + (g.totalDownVotes || 0);
        const likeRatio = totalVotes > 0 ? (g.totalUpVotes || 0) / totalVotes : undefined;
        const genre = g.genreL1 || 'General';
        const archetype = classifyArchetype(g.name, genre, [g.ageRecommendationDisplayName || '']);

        return {
          id: `roblox_${g.universeId}`,
          platform: 'roblox',
          title: g.name,
          genre,
          archetype,
          metricValue: g.playerCount || 0,
          metricType: 'ccu',
          likeRatio,
          url: `https://www.roblox.com/games/${g.rootPlaceId}`,
          tags: [sortId, genre, g.ageRecommendationDisplayName || ''].filter(Boolean),
          sortSource: sortId,
          timestamp: now,
        };
      });
    } catch (error) {
      console.error(`[RobloxCollector] Error fetching sort ${sortId}:`, error);
      return [];
    }
  }

  async fetchAllKeySorts(): Promise<NormalizedGame[]> {
    const sorts: RobloxSortType[] = ['top-playing-now', 'top-trending', 'up-and-coming', 'top-revisited'];
    const results = await Promise.all(sorts.map(s => this.fetchSort(s)));
    
    // Deduplicate by universeId while preserving the highest CCU or up-and-coming flags
    const map = new Map<string, NormalizedGame>();
    for (const list of results) {
      for (const game of list) {
        if (!map.has(game.id)) {
          map.set(game.id, game);
        } else {
          // Merge tags and preserve highest metric
          const existing = map.get(game.id)!;
          existing.tags = Array.from(new Set([...existing.tags, ...game.tags]));
          if (game.metricValue > existing.metricValue) {
            existing.metricValue = game.metricValue;
          }
        }
      }
    }
    return Array.from(map.values());
  }
}
