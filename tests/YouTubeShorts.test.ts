import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YouTubeShortsAnalyzer } from '../src/collectors/youtube_shorts.js';
import { OpportunityScorer } from '../src/analyzer/scorer.js';
import { ShortsVideoItem } from '../src/types/index.js';

describe('YouTubeShortsAnalyzer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Сбор динамики просмотров роликов по тегам (#shorts, #roblox, #gamedev)', () => {
    it('должен парсить ответ Invidious API и формировать типизированный список ShortsVideoItem', async () => {
      const mockInvidiousData = [
        {
          type: 'video',
          videoId: 'vid_roblox_1',
          title: 'Steal An Egg from Dragon in Roblox #shorts #roblox',
          description: 'Crazy escape with golden egg!',
          viewCount: 3500000,
          published: 1710000000,
          author: 'RobloxGamer',
        },
        {
          type: 'video',
          videoId: 'vid_roblox_2',
          title: 'Skibidi Toilet Tower Defense Update #shorts',
          description: 'Cameraman army vs skibidi toilet boss',
          viewCount: 12000000,
          published: 1710100000,
          author: 'ToiletMaster',
        },
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockInvidiousData,
      } as Response);

      const analyzer = new YouTubeShortsAnalyzer({
        fetchFn: mockFetch,
        invidiousInstances: ['https://mock-invidious.test'],
      });

      const items = await analyzer.fetchTagSlice('#roblox', { limit: 10 });

      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({
        id: 'vid_roblox_1',
        title: 'Steal An Egg from Dragon in Roblox #shorts #roblox',
        description: 'Crazy escape with golden egg!',
        viewCount: 3500000,
        publishedAt: new Date(1710000000 * 1000).toISOString(),
        url: 'https://www.youtube.com/shorts/vid_roblox_1',
        channelTitle: 'RobloxGamer',
        matchedTags: ['#roblox'],
      });
      expect(items[1].viewCount).toBe(12000000);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://mock-invidious.test/api/v1/search?q=%23roblox'),
        expect.any(Object)
      );
    });

    it('должен сканировать несколько срезов (#shorts, #roblox, #gamedev) и дедуплицировать ролики', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('%23shorts')) {
          return {
            ok: true,
            json: async () => [
              { videoId: 'dup_1', title: 'Shared Video #shorts #roblox', viewCount: 500000 },
              { videoId: 'shorts_only', title: 'Gamedev Devlog #shorts', viewCount: 150000 },
            ],
          };
        }
        if (url.includes('%23roblox')) {
          return {
            ok: true,
            json: async () => [
              { videoId: 'dup_1', title: 'Shared Video #shorts #roblox', viewCount: 500000 },
              { videoId: 'roblox_only', title: 'Brainrot Obby #roblox', viewCount: 800000 },
            ],
          };
        }
        if (url.includes('%23gamedev')) {
          return {
            ok: true,
            json: async () => [
              { videoId: 'gamedev_only', title: 'Making Roblox Game in 24h #gamedev', viewCount: 250000 },
            ],
          };
        }
        return { ok: false, status: 404 };
      });

      const analyzer = new YouTubeShortsAnalyzer({
        fetchFn: mockFetch as any,
        invidiousInstances: ['https://mock-invidious.test'],
      });

      const videos = await analyzer.scanTrendingSlices(['#shorts', '#roblox', '#gamedev']);

      // 4 уникальных видео вместо 5
      expect(videos).toHaveLength(4);
      const dupVideo = videos.find((v) => v.id === 'dup_1');
      expect(dupVideo).toBeDefined();
      expect(dupVideo?.matchedTags).toContain('#shorts');
      expect(dupVideo?.matchedTags).toContain('#roblox');
    });

    it('должен переключаться на следующее зеркало Invidious при сбое первого инстанса', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('mirror1.test')) {
          return { ok: false, status: 502 };
        }
        if (url.includes('mirror2.test')) {
          return {
            ok: true,
            json: async () => [{ videoId: 'mirror2_vid', title: 'Recovered Video', viewCount: 100000 }],
          };
        }
        return { ok: false, status: 500 };
      });

      const analyzer = new YouTubeShortsAnalyzer({
        fetchFn: mockFetch as any,
        invidiousInstances: ['https://mirror1.test', 'https://mirror2.test'],
      });

      const videos = await analyzer.fetchTagSlice('#gamedev');
      expect(videos).toHaveLength(1);
      expect(videos[0].id).toBe('mirror2_vid');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('должен поддерживать YouTube Data API v3 при наличии apiKey', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/youtube/v3/search')) {
          return {
            ok: true,
            json: async () => ({
              items: [
                {
                  id: { videoId: 'yt_api_1' },
                  snippet: {
                    title: 'Official YouTube API Short #shorts',
                    description: 'Description from snippet',
                    channelTitle: 'GamedevChannel',
                    publishedAt: '2026-03-01T12:00:00Z',
                  },
                },
              ],
            }),
          };
        }
        if (url.includes('/youtube/v3/videos')) {
          return {
            ok: true,
            json: async () => ({
              items: [
                {
                  id: 'yt_api_1',
                  statistics: { viewCount: '4500000' },
                },
              ],
            }),
          };
        }
        return { ok: false, status: 400 };
      });

      const analyzer = new YouTubeShortsAnalyzer({
        apiKey: 'TEST_YOUTUBE_API_KEY',
        fetchFn: mockFetch as any,
      });

      const items = await analyzer.fetchTagSlice('#shorts');
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('yt_api_1');
      expect(items[0].viewCount).toBe(4500000);
      expect(items[0].channelTitle).toBe('GamedevChannel');
    });
  });

  describe('2. Детекция быстрорастущих вирусных персонажей и мемов', () => {
    const sampleVideos: ShortsVideoItem[] = [
      {
        id: '1',
        title: 'SKIBIDI TOILET BOSS FIGHT in Roblox #shorts',
        description: 'Titan Speakerman vs G-Man Skibidi Toilet',
        viewCount: 15000000,
        url: 'https://youtube.com/shorts/1',
      },
      {
        id: '2',
        title: 'Скибиди туалет захватил город! Смешные моменты',
        description: 'Камерамен бежит от скибиди',
        viewCount: 6000000,
        url: 'https://youtube.com/shorts/2',
      },
      {
        id: '3',
        title: 'The Amazing Digital Circus: Pomni Escape Obby',
        description: 'Can Jax and Pomni escape Caine in Digital Circus?',
        viewCount: 8500000,
        url: 'https://youtube.com/shorts/3',
      },
      {
        id: '4',
        title: 'Цифровой цирк в Роблокс: Помни плачет',
        description: 'Джакс троллит Помни',
        viewCount: 4200000,
        url: 'https://youtube.com/shorts/4',
      },
      {
        id: '5',
        title: 'Sigma Rizz Only in Ohio Brainrot Simulator',
        description: 'Level 10 Gyatt with Baby Gronk and Mewing Gigachad',
        viewCount: 11000000,
        url: 'https://youtube.com/shorts/5',
      },
      {
        id: '6',
        title: 'Украли яйцо у дракона! Steal An Egg and Run!',
        description: 'Catch & run away before monster wakes up',
        viewCount: 7800000,
        url: 'https://youtube.com/shorts/6',
      },
      {
        id: '7',
        title: 'Classic Chess Tutorial for Beginners',
        description: 'How to play chess openings',
        viewCount: 10000,
        url: 'https://youtube.com/shorts/7',
      },
    ];

    it('должен детектировать все 4 целевых мема (Skibidi, Digital Circus, Brainrot, Steal An Egg)', () => {
      const analyzer = new YouTubeShortsAnalyzer();
      const memes = analyzer.detectViralMemes(sampleVideos);

      const skibidi = memes.find((m) => m.memeId === 'skibidi');
      const circus = memes.find((m) => m.memeId === 'digital_circus');
      const brainrot = memes.find((m) => m.memeId === 'brainrot');
      const stealEgg = memes.find((m) => m.memeId === 'steal_an_egg');

      expect(skibidi).toBeDefined();
      expect(skibidi?.occurrences).toBe(2);
      expect(skibidi?.totalViews).toBe(21000000);
      expect(skibidi?.avgViews).toBe(10500000);
      expect(skibidi?.sampleTitles).toHaveLength(2);

      expect(circus).toBeDefined();
      expect(circus?.occurrences).toBe(2);
      expect(circus?.totalViews).toBe(12700000);

      expect(brainrot).toBeDefined();
      expect(brainrot?.occurrences).toBe(1);
      expect(brainrot?.totalViews).toBe(11000000);

      expect(stealEgg).toBeDefined();
      expect(stealEgg?.occurrences).toBe(1);
      expect(stealEgg?.totalViews).toBe(7800000);
    });

    it('должен корректно рассчитывать высокий viralMultiplier для вирусных мемов и 1.0 для отсутствующих', () => {
      const analyzer = new YouTubeShortsAnalyzer();
      const memes = analyzer.detectViralMemes(sampleVideos);

      for (const m of memes) {
        expect(m.viralMultiplier).toBeGreaterThanOrEqual(1.5);
        expect(m.viralMultiplier).toBeLessThanOrEqual(2.5);
      }

      // Пустая выборка
      const emptyMemes = analyzer.detectViralMemes([]);
      for (const m of emptyMemes) {
        expect(m.occurrences).toBe(0);
        expect(m.totalViews).toBe(0);
        expect(m.viralMultiplier).toBe(1.0);
      }
    });
  });

  describe('3. Расчет коэффициента вирусного ускорения (Viral Multiplier) и интеграция со Scorer', () => {
    it('должен вычислять Viral Multiplier для соответствующих игровых архетипов', () => {
      const analyzer = new YouTubeShortsAnalyzer();
      const detectedMemes = [
        {
          memeId: 'skibidi',
          name: 'Skibidi Toilet',
          pattern: 'skibidi',
          occurrences: 5,
          totalViews: 25000000,
          avgViews: 5000000,
          viralMultiplier: 1.85,
          sampleTitles: ['Skibidi Wars'],
        },
        {
          memeId: 'steal_an_egg',
          name: 'Steal An Egg',
          pattern: 'steal an egg',
          occurrences: 3,
          totalViews: 12000000,
          avgViews: 4000000,
          viralMultiplier: 1.7,
          sampleTitles: ['Steal An Egg'],
        },
      ];

      // SIMULATION_INCREMENTAL связан со Skibidi и Steal An Egg
      const simMultiplier = analyzer.calculateViralMultiplier('SIMULATION_INCREMENTAL', detectedMemes);
      expect(simMultiplier).toBeGreaterThanOrEqual(1.85);

      // WORD_PUZZLE не имеет связей с этими мемами
      const puzzleMultiplier = analyzer.calculateViralMultiplier('WORD_PUZZLE', detectedMemes);
      expect(puzzleMultiplier).toBe(1.0);
    });

    it('должен увеличивать velocityScore и overallScore в OpportunityScorer при передаче viralMultiplier > 1.0', () => {
      const scorer = new OpportunityScorer();

      // Базовый скоринг без вирусного ускорения (multiplier = 1.0, hasUpAndComing = false)
      const baseScore = scorer.calculateScore('SIMULATION_INCREMENTAL', 300000, 15, false, 1.0);

      // Скоринг с вирусным ускорением Shorts (multiplier = 1.4)
      const boostedScore = scorer.calculateScore('SIMULATION_INCREMENTAL', 300000, 15, false, 1.4);

      expect(boostedScore.viralMultiplier).toBe(1.4);
      expect(boostedScore.velocityScore).toBeGreaterThan(baseScore.velocityScore);
      expect(boostedScore.overallScore).toBeGreaterThan(baseScore.overallScore);
    });
  });

  describe('4. Отказоустойчивость и Fallback при сбоях сети', () => {
    it('должен возвращать курируемые тренды без исключений при падении всех сетевых зеркал', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network unreachable / DNS fail'));

      const analyzer = new YouTubeShortsAnalyzer({
        fetchFn: mockFetch as any,
        invidiousInstances: ['https://down1.test', 'https://down2.test'],
      });

      const trends = await analyzer.getViralShortsTrends({ live: true });

      // Должен активироваться fallback на курируемый датасет
      expect(trends.length).toBeGreaterThan(0);
      expect(trends[0].platform).toBe('youtube_trends');
      expect(trends.some((t) => t.title.includes('Steal An Egg'))).toBe(true);
      expect(trends.some((t) => t.title.includes('Ragdoll Dismount'))).toBe(true);
    });
  });
});
