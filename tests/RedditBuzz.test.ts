import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RedditBuzzHarvester,
  DEFAULT_REDDIT_SUBREDDITS,
  DEFAULT_USER_AGENT,
  RedditPost,
  BuzzEntity,
  RedditBuzzReport,
} from '../src/collectors/reddit_buzz.js';

describe('RedditBuzzHarvester', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Конфигурация и значения по умолчанию', () => {
    it('должен содержать 4 целевых сабреддита по умолчанию: roblox, RobloxAvatars, gamedev, memes', () => {
      expect(DEFAULT_REDDIT_SUBREDDITS).toEqual([
        'roblox',
        'RobloxAvatars',
        'gamedev',
        'memes',
      ]);
    });

    it('должен иметь уникальный User-Agent по умолчанию', () => {
      expect(DEFAULT_USER_AGENT).toMatch(/GameTrendRadar/i);
    });

    it('должен инициализироваться с дефолтными параметрами фильтрации', () => {
      const harvester = new RedditBuzzHarvester();
      expect(harvester.getSubreddits()).toEqual(DEFAULT_REDDIT_SUBREDDITS);
      expect(harvester.getUserAgent()).toBe(DEFAULT_USER_AGENT);
      expect(harvester.getMinUps()).toBe(100);
      expect(harvester.getMinComments()).toBe(50);
      expect(harvester.getMaxAgeHours()).toBe(48);
      expect(harvester.getLimit()).toBe(50);
    });

    it('должен нормализовать имена сабреддитов, удаляя префиксы r/ и слеши', () => {
      const harvester = new RedditBuzzHarvester({
        subreddits: ['r/roblox', '/r/RobloxAvatars/', 'gamedev'],
      });
      expect(harvester.getSubreddits()).toEqual(['roblox', 'RobloxAvatars', 'gamedev']);
    });
  });

  describe('2. Сетевые запросы к Reddit JSON API', () => {
    it('должен формировать корректный URL и передавать уникальный User-Agent в заголовках', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        expect(url).toBe('https://www.reddit.com/r/roblox/hot.json?limit=50');
        expect(init?.headers).toEqual(
          expect.objectContaining({
            'User-Agent': DEFAULT_USER_AGENT,
          })
        );

        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            kind: 'Listing',
            data: {
              children: [],
            },
          }),
        } as Response);
      });

      const harvester = new RedditBuzzHarvester({ fetchFn: mockFetch });
      const posts = await harvester.fetchSubredditPosts('roblox');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(posts).toEqual([]);
    });

    it('должен устойчиво обрабатывать сетевые ошибки и HTTP статусы ошибок, возвращая пустой массив', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response);

      const harvester = new RedditBuzzHarvester({ fetchFn: mockFetch });
      const posts = await harvester.fetchSubredditPosts('memes');

      expect(posts).toEqual([]);
    });
  });

  describe('3. Фильтрация постов (ups > 100 ИЛИ num_comments > 50, возраст <= 48ч)', () => {
    const nowSec = 1700000000;
    const nowMs = nowSec * 1000;

    it('должен пропускать посты с ups > 100 за последние 48 часов', () => {
      const harvester = new RedditBuzzHarvester();
      const post: RedditPost = {
        id: 'p1',
        title: 'New viral Roblox mechanics',
        subreddit: 'roblox',
        ups: 150,
        num_comments: 10,
        created_utc: nowSec - 3600 * 12, // 12 часов назад
        url: 'https://reddit.com/r/roblox/p1',
        permalink: '/r/roblox/p1',
      };

      expect(harvester.isViralPost(post, nowMs)).toBe(true);
    });

    it('должен пропускать посты с num_comments > 50 за последние 48 часов даже если ups <= 100', () => {
      const harvester = new RedditBuzzHarvester();
      const post: RedditPost = {
        id: 'p2',
        title: 'Controversial game design debate',
        subreddit: 'gamedev',
        ups: 45,
        num_comments: 85,
        created_utc: nowSec - 3600 * 24, // 24 часа назад
        url: 'https://reddit.com/r/gamedev/p2',
        permalink: '/r/gamedev/p2',
      };

      expect(harvester.isViralPost(post, nowMs)).toBe(true);
    });

    it('должен отсеивать посты старше 48 часов, даже если у них много лайков и комментариев', () => {
      const harvester = new RedditBuzzHarvester();
      const post: RedditPost = {
        id: 'p3',
        title: 'Old popular post',
        subreddit: 'memes',
        ups: 5000,
        num_comments: 600,
        created_utc: nowSec - 3600 * 50, // 50 часов назад
        url: 'https://reddit.com/r/memes/p3',
        permalink: '/r/memes/p3',
      };

      expect(harvester.isViralPost(post, nowMs)).toBe(false);
    });

    it('должен отсеивать посты с низким вовлечением (ups <= 100 И num_comments <= 50)', () => {
      const harvester = new RedditBuzzHarvester();
      const post: RedditPost = {
        id: 'p4',
        title: 'Ordinary quiet post',
        subreddit: 'roblox',
        ups: 50,
        num_comments: 12,
        created_utc: nowSec - 3600 * 2, // 2 часа назад
        url: 'https://reddit.com/r/roblox/p4',
        permalink: '/r/roblox/p4',
      };

      expect(harvester.isViralPost(post, nowMs)).toBe(false);
    });
  });

  describe('4. Извлечение ключевых сущностей из заголовков', () => {
    it('должен очищать заголовок от спецсимволов, эмодзи и стоп-слов', () => {
      const harvester = new RedditBuzzHarvester();
      const tokens = harvester.extractKeywords('🔥 Look at this INSANE new Dress to Impress update in Roblox! 🚀');

      expect(tokens).toContain('dress to impress');
      expect(tokens).toContain('dress');
      expect(tokens).toContain('impress');
      expect(tokens).not.toContain('look');
      expect(tokens).not.toContain('this');
      expect(tokens).not.toContain('in');
      expect(tokens).not.toContain('at');
    });

    it('должен выявлять повторяющиеся сущности между несколькими постами', () => {
      const harvester = new RedditBuzzHarvester();
      const posts: RedditPost[] = [
        {
          id: 'p1',
          title: 'Steep Steps gameplay is totally addictive',
          subreddit: 'roblox',
          ups: 200,
          num_comments: 40,
          created_utc: 1700000000,
          url: 'url1',
          permalink: 'perm1',
        },
        {
          id: 'p2',
          title: 'Why Steep Steps has the best mountain climbing mechanics',
          subreddit: 'gamedev',
          ups: 150,
          num_comments: 70,
          created_utc: 1700001000,
          url: 'url2',
          permalink: 'perm2',
        },
        {
          id: 'p3',
          title: 'Unrelated funny meme about unity vs godot',
          subreddit: 'memes',
          ups: 300,
          num_comments: 80,
          created_utc: 1700002000,
          url: 'url3',
          permalink: 'perm3',
        },
      ];

      const entities = harvester.extractBuzzEntities(posts, { minOccurrences: 2 });
      const steepSteps = entities.find(e => e.name === 'steep steps');

      expect(steepSteps).toBeDefined();
      expect(steepSteps?.occurrences).toBe(2);
      expect(steepSteps?.subreddits).toEqual(expect.arrayContaining(['roblox', 'gamedev']));
      expect(steepSteps?.sampleTitles).toHaveLength(2);
    });
  });

  describe('5. Расчет показателя Buzz Score (социальный резонанс)', () => {
    it('должен рассчитывать Buzz Score с учетом апвоутов, комментариев и частоты упоминаний', () => {
      const harvester = new RedditBuzzHarvester();

      // ups = 200, comments = 100, occurrences = 2
      // comments имеют повышенный вес как индикатор живой дискуссии
      const score = harvester.calculateBuzzScore({
        totalUps: 200,
        totalComments: 100,
        occurrences: 2,
      });

      expect(score).toBeGreaterThan(0);
      expect(typeof score).toBe('number');

      // Сущность с большей дискуссией и повторяемостью должна получать более высокий Buzz Score
      const higherResonanceScore = harvester.calculateBuzzScore({
        totalUps: 500,
        totalComments: 300,
        occurrences: 4,
      });

      expect(higherResonanceScore).toBeGreaterThan(score);
    });

    it('должен сортировать сущности по Buzz Score по убыванию', () => {
      const harvester = new RedditBuzzHarvester();
      const posts: RedditPost[] = [
        {
          id: 'p1',
          title: 'Fish It update broke the fishing leaderboard',
          subreddit: 'roblox',
          ups: 1200,
          num_comments: 450,
          created_utc: 1700000000,
          url: 'url1',
          permalink: 'perm1',
        },
        {
          id: 'p2',
          title: 'New Fish It mechanics are amazing for idle players',
          subreddit: 'roblox',
          ups: 900,
          num_comments: 310,
          created_utc: 1700001000,
          url: 'url2',
          permalink: 'perm2',
        },
        {
          id: 'p3',
          title: 'Simple obby test',
          subreddit: 'roblox',
          ups: 110,
          num_comments: 5,
          created_utc: 1700002000,
          url: 'url3',
          permalink: 'perm3',
        },
      ];

      const entities = harvester.extractBuzzEntities(posts);
      expect(entities.length).toBeGreaterThan(0);
      // Проверяем сортировку по убыванию buzzScore
      for (let i = 0; i < entities.length - 1; i++) {
        expect(entities[i].buzzScore).toBeGreaterThanOrEqual(entities[i + 1].buzzScore);
      }
    });
  });

  describe('6. Комплексный сбор и формирование отчета (harvest)', () => {
    it('должен собирать данные со всех указанных сабреддитов, фильтровать вирусные посты и формировать сводный отчет', async () => {
      const nowSec = Math.floor(Date.now() / 1000);

      const fakeRedditListing = (subreddit: string, items: Array<{ title: string; ups: number; comments: number }>) => ({
        kind: 'Listing',
        data: {
          children: items.map((item, idx) => ({
            kind: 't3',
            data: {
              id: `${subreddit}_${idx}`,
              title: item.title,
              subreddit: subreddit,
              ups: item.ups,
              num_comments: item.comments,
              created_utc: nowSec - 3600 * 5, // 5 часов назад
              url: `https://reddit.com/r/${subreddit}/comments/${subreddit}_${idx}`,
              permalink: `/r/${subreddit}/comments/${subreddit}_${idx}`,
              author: `author_${idx}`,
            },
          })),
        },
      });

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        let items: Array<{ title: string; ups: number; comments: number }> = [];

        if (url.includes('/r/roblox/')) {
          items = [
            { title: 'The rise of Dress to Impress fashion meta', ups: 850, comments: 210 },
            { title: 'Dress to Impress codes and avatar tricks', ups: 620, comments: 140 },
            { title: 'Unpopular small post', ups: 10, comments: 2 },
          ];
        } else if (url.includes('/r/RobloxAvatars/')) {
          items = [
            { title: 'Rate my gothic avatar concept', ups: 340, comments: 120 },
            { title: 'New avatar customization trend', ups: 410, comments: 90 },
          ];
        } else if (url.includes('/r/gamedev/')) {
          items = [
            { title: 'Steam vs Roblox monetization for indie devs', ups: 520, comments: 310 },
          ];
        } else if (url.includes('/r/memes/')) {
          items = [
            { title: 'When your code runs without errors on first try', ups: 4500, comments: 180 },
          ];
        }

        const match = url.match(/\/r\/([^\/]+)\//);
        const sub = match ? match[1] : 'roblox';

        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => fakeRedditListing(sub, items),
        } as Response);
      });

      const harvester = new RedditBuzzHarvester({
        fetchFn: mockFetch,
        subreddits: ['roblox', 'RobloxAvatars', 'gamedev', 'memes'],
      });

      const report: RedditBuzzReport = await harvester.harvest();

      expect(report.subreddits).toEqual(['roblox', 'RobloxAvatars', 'gamedev', 'memes']);
      expect(report.filteredPostsCount).toBeGreaterThan(0);
      expect(report.posts.some(p => p.title.includes('Dress to Impress'))).toBe(true);
      expect(report.posts.some(p => p.title === 'Unpopular small post')).toBe(false); // отфильтрован
      expect(report.buzzEntities.length).toBeGreaterThan(0);

      // Проверяем наличие topTrendingEntity
      expect(report.topTrendingEntity).toBeDefined();
      expect(report.topTrendingEntity?.buzzScore).toBeGreaterThan(0);
    });
  });
});
