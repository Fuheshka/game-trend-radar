import { describe, it, expect } from 'vitest';
import { recordSnapshot, findNewEntries, findRisers } from '../src/analyzer/game_history.js';
import { parseYandexAppState } from '../src/collectors/yandex_games.js';
import { MarketSnapshot, NormalizedGame } from '../src/types/index.js';

const game = (id: string, metricValue: number, extra: Partial<NormalizedGame> = {}): NormalizedGame => ({
  id,
  platform: 'roblox',
  title: id,
  genre: 'x',
  archetype: 'OTHER_CASUAL',
  metricValue,
  metricType: 'ccu',
  tags: [],
  timestamp: '',
  ...extra,
});

const snap = (day: string, games: NormalizedGame[]): MarketSnapshot => ({
  id: day,
  timestamp: `${day}T10:00:00.000Z`,
  totalGamesScanned: games.length,
  platformCounts: { roblox: 0, yandex_games: 0, poki: 0, youtube_trends: 0 },
  robloxTotalCCU: 0,
  games,
  verdicts: [],
});

describe('game history', () => {
  const days = ['2026-10-10', '2026-10-13', '2026-10-17'];
  let h = recordSnapshot(null, snap(days[0], [game('giant', 400_000), game('riser', 2_000)]));
  h = recordSnapshot(h, snap(days[1], [game('giant', 410_000), game('riser', 9_000), game('fresh', 5_000)]));
  h = recordSnapshot(h, snap(days[2], [game('giant', 405_000), game('riser', 30_000), game('fresh', 8_000)]));

  it('treats baseline games as old and later arrivals as new', () => {
    const fresh = findNewEntries(h, days[2]);
    expect(fresh.map(e => e.id)).toEqual(['fresh']);
    expect(fresh[0].ageDays).toBe(4);
  });

  it('ranks by growth, not absolute size', () => {
    const risers = findRisers(h, days[2]);
    expect(risers[0].id).toBe('riser');
    expect(risers[0].growthPct).toBe(1400);
    expect(risers.find(r => r.id === 'giant')).toBeUndefined();
  });

  it('keeps one point per day and last scan of the day wins', () => {
    const h2 = recordSnapshot(structuredClone(h), snap(days[2], [game('riser', 31_000)]));
    expect(h2.games.riser.points).toHaveLength(3);
    expect(h2.games.riser.points[2][1]).toBe(31_000);
  });

  it('uses Yandex vote count and Poki rank as growth signals', () => {
    let y = recordSnapshot(null, snap('2026-10-01', []));
    const yx = (votes: number) => game('yandex_1', 90, { platform: 'yandex_games', metricType: 'rating', votes });
    const pk = (rank: number) => game('poki_a', rank, { platform: 'poki', metricType: 'rank' });
    y = recordSnapshot(y, snap('2026-10-02', [yx(100), pk(40)]));
    y = recordSnapshot(y, snap('2026-10-05', [yx(400), pk(10)]));
    const r = findRisers(y, '2026-10-05');
    expect(r.find(x => x.id === 'yandex_1')).toMatchObject({ signal: 'votes', from: 100, to: 400, growthPct: 300 });
    expect(r.find(x => x.id === 'poki_a')).toMatchObject({ signal: 'rank', from: 40, to: 10, growthPct: 75 });
  });
});

describe('parseYandexAppState', () => {
  it('reads real rating fields from __appState__', () => {
    const state = {
      feedsData: {
        common: [
          {
            items: [
              { title: 'Переноска муравьями', appSlug: 'perenoska-566346', appID: 566346, rating: 4.6, ratingCount: 1200, gqRating: 95 },
              { title: 'Без gq', appSlug: 'bez-1', appID: 1, rating: 4, ratingCount: 0 },
            ],
          },
        ],
      },
      feedback: { appID: null, title: 'not a game' },
    };
    const html = `<script id="__appState__" type="mime/invalid">${JSON.stringify(state)}</script>`;
    const games = parseYandexAppState(html, 'now');
    expect(games).toHaveLength(2);
    expect(games[0]).toMatchObject({ id: 'yandex_566346', metricValue: 95, votes: 1200, url: 'https://yandex.ru/games/app/perenoska-566346' });
    expect(games[1].metricValue).toBe(80);
  });

  it('returns empty list without state or with broken JSON', () => {
    expect(parseYandexAppState('<html></html>', 'now')).toEqual([]);
    expect(parseYandexAppState('<script id="__appState__">{bad</script>', 'now')).toEqual([]);
  });
});

describe('per-platform baseline', () => {
  it('does not flag a whole catalog as new when its collector was down on day one', () => {
    let h = recordSnapshot(null, snap('2026-10-01', [game('r1', 5000)]));
    const pk = game('poki_a', 3, { platform: 'poki', metricType: 'rank' });
    h = recordSnapshot(h, snap('2026-10-02', [game('r1', 5000), pk]));
    h = recordSnapshot(h, snap('2026-10-03', [game('r1', 5000), pk, game('poki_b', 9, { platform: 'poki', metricType: 'rank' })]));
    expect(findNewEntries(h, '2026-10-03').map(e => e.id)).toEqual(['poki_b']);
  });
});
