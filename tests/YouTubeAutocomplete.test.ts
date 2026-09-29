import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  YouTubeAutocompleteHarvester,
  DEFAULT_SEARCH_PREFIXES,
  DEFAULT_INVIDIOUS_INSTANCES,
  AutocompleteSuggestion,
  TrendingGamingVideo,
} from '../src/collectors/youtube_autocomplete.js';

describe('YouTubeAutocompleteHarvester', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Конфигурация и значения по умолчанию', () => {
    it('должен содержать 5 целевых префиксов по умолчанию', () => {
      expect(DEFAULT_SEARCH_PREFIXES).toEqual([
        'roblox ',
        'shorts roblox ',
        'роблокс ',
        'game dev shorts ',
        'simulator roblox ',
      ]);
    });

    it('должен инициализироваться с таймаутом 5000 мс и зеркалами Invidious', () => {
      const harvester = new YouTubeAutocompleteHarvester();
      expect(harvester.getTimeoutMs()).toBe(5000);
      expect(harvester.getInvidiousInstances().length).toBeGreaterThan(0);
    });
  });

  describe('2. Сбор поисковых подсказок YouTube Autocomplete (fetchSearchSuggestions)', () => {
    it('должен парсить JSONP формат window.google.ac.h(...) и извлекать подсказки с суффиксами', async () => {
      const mockJsonp = 'window.google.ac.h(["roblox ",[["roblox bedwars",0,[22,35]],["roblox song",0,[22,35]]],{"k":1}])';

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        expect(url).toContain('suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=roblox');
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => mockJsonp,
        } as Response);
      });

      const harvester = new YouTubeAutocompleteHarvester({ fetchFn: mockFetch });
      const suggestions = await harvester.fetchSearchSuggestions(['roblox ']);

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0]).toEqual({
        query: 'roblox bedwars',
        prefix: 'roblox ',
        suffix: 'bedwars',
      });
      expect(suggestions[1]).toEqual({
        query: 'roblox song',
        prefix: 'roblox ',
        suffix: 'song',
      });
    });

    it('должен парсить чистый JSON и очищать HTML-теги <b>...</b>', async () => {
      const mockJson = JSON.stringify([
        'shorts roblox ',
        [
          ['shorts roblox <b>animation</b>', 0],
          ['shorts roblox <b>funny moments</b>', 0],
        ],
      ]);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockJson,
      } as Response);

      const harvester = new YouTubeAutocompleteHarvester({ fetchFn: mockFetch });
      const suggestions = await harvester.fetchSearchSuggestions(['shorts roblox ']);

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].query).toBe('shorts roblox animation');
      expect(suggestions[0].suffix).toBe('animation');
      expect(suggestions[1].query).toBe('shorts roblox funny moments');
      expect(suggestions[1].suffix).toBe('funny moments');
    });

    it('должен удалять дубликаты поисковых запросов и нормализовать регистр при дедупликации', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('roblox')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify(['roblox ', [['roblox blox fruits', 0], ['Roblox Blox Fruits', 0]]]),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(['simulator roblox ', [['roblox blox fruits', 0]]]),
        } as Response);
      });

      const harvester = new YouTubeAutocompleteHarvester({ fetchFn: mockFetch });
      const suggestions = await harvester.fetchSearchSuggestions(['roblox ', 'simulator roblox ']);

      // Должен остаться ровно 1 уникальный запрос
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].query.toLowerCase()).toBe('roblox blox fruits');
    });

    it('должен использовать DEFAULT_SEARCH_PREFIXES если префиксы не переданы', async () => {
      const calledUrls: string[] = [];
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        calledUrls.push(url);
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(['q', []]),
        } as Response);
      });

      const harvester = new YouTubeAutocompleteHarvester({ fetchFn: mockFetch });
      await harvester.fetchSearchSuggestions();

      expect(calledUrls).toHaveLength(DEFAULT_SEARCH_PREFIXES.length);
    });

    it('должен продолжать сбор если один из префиксов завершился ошибкой (отказоустойчивость)', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('bad_prefix')) {
          return Promise.reject(new Error('Network offline'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(['good', [['good game', 0]]]),
        } as Response);
      });

      const harvester = new YouTubeAutocompleteHarvester({ fetchFn: mockFetch });
      const suggestions = await harvester.fetchSearchSuggestions(['bad_prefix', 'good']);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].query).toBe('good game');
    });

    it('должен возвращать пустой массив при сбое всех запросов без падения процесса', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Complete network failure'));
      const harvester = new YouTubeAutocompleteHarvester({ fetchFn: mockFetch });

      const suggestions = await harvester.fetchSearchSuggestions(['roblox ']);
      expect(suggestions).toEqual([]);
    });
  });

  describe('3. Сбор суточных игровых трендов Invidious Gaming (fetchTrendingGamingVideos)', () => {
    it('должен опрашивать /api/v1/trending?type=gaming и извлекать топ-50 видео', async () => {
      const generateMockVideos = (count: number) => {
        return Array.from({ length: count }, (_, i) => ({
          type: 'video',
          videoId: `game_vid_${i + 1}`,
          title: `Gaming Trend #${i + 1} Roblox Steal Egg`,
          description: `Description for video ${i + 1}`,
          viewCount: (count - i) * 100000,
          author: `Streamer_${i + 1}`,
          published: 1710000000 + i * 3600,
          publishedText: `${i + 1} hours ago`,
        }));
      };

      const mockVideos60 = generateMockVideos(60);

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        expect(url).toBe('https://mock.invidious.test/api/v1/trending?type=gaming');
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockVideos60,
        } as Response);
      });

      const harvester = new YouTubeAutocompleteHarvester({
        fetchFn: mockFetch,
        invidiousInstances: ['https://mock.invidious.test'],
      });

      const trending = await harvester.fetchTrendingGamingVideos();

      // Ограничение ровно топ-50
      expect(trending).toHaveLength(50);
      expect(trending[0]).toEqual({
        id: 'game_vid_1',
        title: 'Gaming Trend #1 Roblox Steal Egg',
        description: 'Description for video 1',
        viewCount: 6000000,
        author: 'Streamer_1',
        url: 'https://www.youtube.com/watch?v=game_vid_1',
        published: 1710000000,
        publishedAt: '1 hours ago',
      });
    });

    it('должен ротировать публичные зеркала Invidious при недоступности первого', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.startsWith('https://broken-instance-1.test')) {
          return Promise.reject(new Error('Connection timeout'));
        }
        if (url.startsWith('https://broken-instance-2.test')) {
          return Promise.resolve({
            ok: false,
            status: 502,
            json: async () => ({ error: 'Bad Gateway' }),
          } as Response);
        }
        if (url.startsWith('https://working-instance.test')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [
              {
                videoId: 'working_vid_1',
                title: 'Working Mirror Gaming Trend',
                viewCount: 500000,
                author: 'ProGamer',
              },
            ],
          } as Response);
        }
        return Promise.reject(new Error('Unknown host'));
      });

      const harvester = new YouTubeAutocompleteHarvester({
        fetchFn: mockFetch,
        invidiousInstances: [
          'https://broken-instance-1.test',
          'https://broken-instance-2.test',
          'https://working-instance.test',
        ],
      });

      const trending = await harvester.fetchTrendingGamingVideos();

      expect(trending).toHaveLength(1);
      expect(trending[0].id).toBe('working_vid_1');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('должен возвращать пустой массив при отказе всех зеркал Invidious без исключений', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('All mirrors down'));

      const harvester = new YouTubeAutocompleteHarvester({
        fetchFn: mockFetch,
        invidiousInstances: ['https://mirror1.test', 'https://mirror2.test'],
      });

      const trending = await harvester.fetchTrendingGamingVideos();
      expect(trending).toEqual([]);
    });

    it('должен корректно применять таймаут 5000 мс через AbortController', async () => {
      let abortSignal: AbortSignal | undefined;

      const mockFetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        abortSignal = init?.signal as AbortSignal;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [],
        } as Response);
      });

      const harvester = new YouTubeAutocompleteHarvester({
        fetchFn: mockFetch,
        timeoutMs: 5000,
        invidiousInstances: ['https://test.mirror'],
      });

      await harvester.fetchTrendingGamingVideos();
      expect(abortSignal).toBeDefined();
    });
  });
});
