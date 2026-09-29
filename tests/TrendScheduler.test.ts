import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TrendScheduler, DynamicMeme, DynamicMemesData } from '../src/cron/trend_scheduler.js';
import { YouTubeShortsAnalyzer } from '../src/collectors/youtube_shorts.js';
import { YouTubeAutocompleteHarvester } from '../src/collectors/youtube_autocomplete.js';
import { RedditBuzzHarvester, RedditBuzzReport } from '../src/collectors/reddit_buzz.js';
import { UnsupervisedTrendExtractor, ExtractedTrend } from '../src/analyzer/trend_extractor.js';
import { RobloxCollector } from '../src/collectors/roblox.js';
import { MarketSnapshot, NormalizedGame } from '../src/types/index.js';

describe('TrendScheduler (Оркестрация авто-источников и динамический словарь мемов)', () => {
  const testDataDir = path.resolve(process.cwd(), 'tests', 'fixtures', 'temp_scheduler');
  const testStorageFile = path.join(testDataDir, 'dynamic_memes.test.json');

  beforeEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('1. Инициализация и конфигурация', () => {
    it('должен инициализироваться с дефолтными путями и создавать инстансы коллекторов', () => {
      const scheduler = new TrendScheduler();
      expect(scheduler.getStoragePath()).toContain('data/dynamic_memes.json');
      expect(scheduler.getYoutubeHarvester()).toBeInstanceOf(YouTubeAutocompleteHarvester);
      expect(scheduler.getRedditHarvester()).toBeInstanceOf(RedditBuzzHarvester);
      expect(scheduler.getTrendExtractor()).toBeInstanceOf(UnsupervisedTrendExtractor);
      expect(scheduler.getRobloxCollector()).toBeInstanceOf(RobloxCollector);
    });

    it('должен принимать кастомные параметры и внедренные зависимости', () => {
      const mockYt = {} as YouTubeAutocompleteHarvester;
      const mockReddit = {} as RedditBuzzHarvester;
      const mockExtractor = {} as UnsupervisedTrendExtractor;
      const mockRoblox = {} as RobloxCollector;

      const scheduler = new TrendScheduler({
        storagePath: testStorageFile,
        youtubeHarvester: mockYt,
        redditHarvester: mockReddit,
        trendExtractor: mockExtractor,
        robloxCollector: mockRoblox,
        minConfidenceThreshold: 30,
        decayStep: 15,
      });

      expect(scheduler.getStoragePath()).toBe(testStorageFile);
      expect(scheduler.getYoutubeHarvester()).toBe(mockYt);
      expect(scheduler.getRedditHarvester()).toBe(mockReddit);
      expect(scheduler.getTrendExtractor()).toBe(mockExtractor);
      expect(scheduler.getRobloxCollector()).toBe(mockRoblox);
    });
  });

  describe('2. Оркестрация сбора данных из 3 источников', () => {
    it('должен агрегировать сигналы из YouTube Autocomplete, Reddit Buzz и Roblox N-Gram', async () => {
      // 1. Mock YouTube Autocomplete
      const mockYtHarvester = {
        fetchSearchSuggestions: vi.fn().mockResolvedValue([
          { query: 'roblox dress to impress', prefix: 'roblox ', suffix: 'dress to impress' },
          { query: 'shorts roblox steal an egg', prefix: 'shorts roblox ', suffix: 'steal an egg' },
          { query: 'roblox tungsten cube', prefix: 'roblox ', suffix: 'tungsten cube' },
        ]),
        fetchTrendingGamingVideos: vi.fn().mockResolvedValue([
          {
            id: 'yt_g1',
            title: 'Dress To Impress runway hacks #shorts',
            description: 'Best VIP outfits in DTI',
            viewCount: 1500000,
            author: 'FashionQueen',
            url: 'https://youtube.com/watch?v=yt_g1',
          },
        ]),
      } as unknown as YouTubeAutocompleteHarvester;

      // 2. Mock Reddit Buzz
      const mockRedditReport: RedditBuzzReport = {
        collectedAt: new Date().toISOString(),
        totalPostsScanned: 50,
        filteredPostsCount: 5,
        subreddits: ['roblox', 'memes'],
        posts: [],
        buzzEntities: [
          {
            name: 'dress to impress',
            occurrences: 4,
            totalUps: 1200,
            totalComments: 350,
            buzzScore: 2800,
            subreddits: ['roblox'],
            sampleTitles: ['DTI new theme is crazy', 'Dress to impress outfit ideas'],
            samplePostUrls: ['https://reddit.com/r/roblox/1'],
          },
          {
            name: 'steep steps',
            occurrences: 2,
            totalUps: 500,
            totalComments: 120,
            buzzScore: 1100,
            subreddits: ['roblox'],
            sampleTitles: ['Steep steps ladder climb challenge'],
            samplePostUrls: ['https://reddit.com/r/roblox/2'],
          },
        ],
        topTrendingEntity: null,
      };

      const mockRedditHarvester = {
        harvest: vi.fn().mockResolvedValue(mockRedditReport),
      } as unknown as RedditBuzzHarvester;

      // 3. Mock Roblox & Trend Extractor
      const mockRobloxGames: NormalizedGame[] = [
        {
          id: 'rbx_1',
          platform: 'roblox',
          title: 'Dress To Impress [SUMMER UPDATE]',
          genre: 'Roleplay',
          archetype: 'SIMULATION_INCREMENTAL',
          metricValue: 250000,
          metricType: 'ccu',
          url: 'https://roblox.com/games/1',
          tags: ['fashion'],
          timestamp: new Date().toISOString(),
        },
        {
          id: 'rbx_2',
          platform: 'roblox',
          title: 'Dress To Impress Runway VIP',
          genre: 'Roleplay',
          archetype: 'SIMULATION_INCREMENTAL',
          metricValue: 80000,
          metricType: 'ccu',
          url: 'https://roblox.com/games/2',
          tags: ['fashion'],
          timestamp: new Date().toISOString(),
        },
        {
          id: 'rbx_3',
          platform: 'roblox',
          title: 'Dress To Impress Outfit Creator',
          genre: 'Roleplay',
          archetype: 'SIMULATION_INCREMENTAL',
          metricValue: 45000,
          metricType: 'ccu',
          url: 'https://roblox.com/games/3',
          tags: ['fashion'],
          timestamp: new Date().toISOString(),
        },
      ];

      const mockRobloxCollector = {
        fetchSort: vi.fn().mockResolvedValue(mockRobloxGames),
        fetchAllKeySorts: vi.fn().mockResolvedValue(mockRobloxGames),
      } as unknown as RobloxCollector;

      const mockTrends: ExtractedTrend[] = [
        {
          ngram: 'dress to impress',
          type: 'trigram',
          currentFrequency: 3,
          previousFrequency: 0,
          growthVelocity: 3.0,
          totalCCU: 375000,
          archetype: 'SIMULATION_INCREMENTAL',
          sampleTitles: [
            'Dress To Impress [SUMMER UPDATE]',
            'Dress To Impress Runway VIP',
            'Dress To Impress Outfit Creator',
          ],
          gameIds: ['rbx_1', 'rbx_2', 'rbx_3'],
        },
      ];

      const mockTrendExtractor = {
        extractTrends: vi.fn().mockReturnValue(mockTrends),
        detectTrendsFromDisk: vi.fn().mockReturnValue(mockTrends),
      } as unknown as UnsupervisedTrendExtractor;

      const scheduler = new TrendScheduler({
        storagePath: testStorageFile,
        youtubeHarvester: mockYtHarvester,
        redditHarvester: mockRedditHarvester,
        trendExtractor: mockTrendExtractor,
        robloxCollector: mockRobloxCollector,
      });

      const result = await scheduler.run();

      expect(result).toBeDefined();
      expect(result.memes.length).toBeGreaterThan(0);
      expect(fs.existsSync(testStorageFile)).toBe(true);

      // Проверяем, что мем 'dress to impress', подтвержденный ВСЕМИ 3 источниками, имеет статус VIRAL и высокий балл
      const dtiMeme = result.memes.find((m) => m.name.toLowerCase().includes('dress to impress'));
      expect(dtiMeme).toBeDefined();
      expect(dtiMeme?.sources).toContain('youtube_autocomplete');
      expect(dtiMeme?.sources).toContain('reddit_buzz');
      expect(dtiMeme?.sources).toContain('roblox_ngram');
      expect(dtiMeme?.trendStatus).toBe('VIRAL');
      expect(dtiMeme?.confidenceScore).toBeGreaterThanOrEqual(75);
      expect(dtiMeme?.associatedArchetypes).toContain('SIMULATION_INCREMENTAL');
    });

    it('должен продолжать работу без сбоев, если один из источников бросает исключение', async () => {
      const failingYtHarvester = {
        fetchSearchSuggestions: vi.fn().mockRejectedValue(new Error('Network offline')),
        fetchTrendingGamingVideos: vi.fn().mockRejectedValue(new Error('Network offline')),
      } as unknown as YouTubeAutocompleteHarvester;

      const mockRedditHarvester = {
        harvest: vi.fn().mockResolvedValue({
          collectedAt: new Date().toISOString(),
          totalPostsScanned: 10,
          filteredPostsCount: 1,
          subreddits: ['roblox'],
          posts: [],
          buzzEntities: [
            {
              name: 'fisch fishing',
              occurrences: 3,
              totalUps: 800,
              totalComments: 200,
              buzzScore: 1900,
              subreddits: ['roblox'],
              sampleTitles: ['Fisch fishing secret rod update'],
              samplePostUrls: ['https://reddit.com/r/roblox/3'],
            },
          ],
          topTrendingEntity: null,
        }),
      } as unknown as RedditBuzzHarvester;

      const mockRobloxCollector = {
        fetchSort: vi.fn().mockResolvedValue([]),
        fetchAllKeySorts: vi.fn().mockResolvedValue([]),
      } as unknown as RobloxCollector;

      const mockTrendExtractor = {
        extractTrends: vi.fn().mockReturnValue([]),
        detectTrendsFromDisk: vi.fn().mockReturnValue([]),
      } as unknown as UnsupervisedTrendExtractor;

      const scheduler = new TrendScheduler({
        storagePath: testStorageFile,
        youtubeHarvester: failingYtHarvester,
        redditHarvester: mockRedditHarvester,
        trendExtractor: mockTrendExtractor,
        robloxCollector: mockRobloxCollector,
      });

      const result = await scheduler.run();
      expect(result.memes.length).toBeGreaterThan(0);
      const fisch = result.memes.find((m) => m.name.toLowerCase().includes('fisch fishing'));
      expect(fisch).toBeDefined();
      expect(fisch?.sources).toContain('reddit_buzz');
    });
  });

  describe('3. Метаданные, актуализация и механизм затухания (Decay / Lifecycle)', () => {
    it('должен сохранять firstSeen и обновлять lastSeen и confidenceScore при повторных замерах', async () => {
      const initialTimestamp = '2026-09-01T12:00:00.000Z';
      const initialData: DynamicMemesData = {
        updatedAt: initialTimestamp,
        totalMemes: 2,
        memes: [
          {
            id: 'dress_to_impress',
            name: 'Dress To Impress',
            keywords: ['dress to impress'],
            regexPattern: 'dress\\s+to\\s+impress',
            associatedArchetypes: ['SIMULATION_INCREMENTAL'],
            confidenceScore: 70,
            firstSeen: initialTimestamp,
            lastSeen: initialTimestamp,
            trendStatus: 'EMERGING',
            sources: ['youtube_autocomplete'],
            sampleTitles: ['Initial run title'],
          },
          {
            id: 'old_fading_meme',
            name: 'Old Fading Meme',
            keywords: ['old fading meme'],
            regexPattern: 'old\\s+fading\\s+meme',
            associatedArchetypes: ['OTHER_CASUAL'],
            confidenceScore: 35,
            firstSeen: initialTimestamp,
            lastSeen: initialTimestamp,
            trendStatus: 'EMERGING',
            sources: ['reddit_buzz'],
            sampleTitles: ['Old title'],
          },
        ],
      };

      fs.mkdirSync(path.dirname(testStorageFile), { recursive: true });
      fs.writeFileSync(testStorageFile, JSON.stringify(initialData, null, 2), 'utf-8');

      // Второй запуск: мем 'dress to impress' снова активен в Reddit и Roblox с высоким баллом
      const mockRedditHarvester = {
        harvest: vi.fn().mockResolvedValue({
          collectedAt: new Date().toISOString(),
          totalPostsScanned: 20,
          filteredPostsCount: 2,
          subreddits: ['roblox'],
          posts: [],
          buzzEntities: [
            {
              name: 'dress to impress',
              occurrences: 5,
              totalUps: 2500,
              totalComments: 600,
              buzzScore: 5000,
              subreddits: ['roblox'],
              sampleTitles: ['DTI is still trending'],
              samplePostUrls: [],
            },
          ],
          topTrendingEntity: null,
        }),
      } as unknown as RedditBuzzHarvester;

      const mockYtHarvester = {
        fetchSearchSuggestions: vi.fn().mockResolvedValue([]),
        fetchTrendingGamingVideos: vi.fn().mockResolvedValue([]),
      } as unknown as YouTubeAutocompleteHarvester;

      const mockRobloxCollector = {
        fetchSort: vi.fn().mockResolvedValue([]),
        fetchAllKeySorts: vi.fn().mockResolvedValue([]),
      } as unknown as RobloxCollector;

      const mockTrendExtractor = {
        extractTrends: vi.fn().mockReturnValue([]),
        detectTrendsFromDisk: vi.fn().mockReturnValue([]),
      } as unknown as UnsupervisedTrendExtractor;

      const scheduler = new TrendScheduler({
        storagePath: testStorageFile,
        youtubeHarvester: mockYtHarvester,
        redditHarvester: mockRedditHarvester,
        trendExtractor: mockTrendExtractor,
        robloxCollector: mockRobloxCollector,
        decayStep: 15,
      });

      const updated = await scheduler.run();

      const dti = updated.memes.find((m) => m.id === 'dress_to_impress');
      expect(dti).toBeDefined();
      expect(dti?.firstSeen).toBe(initialTimestamp); // firstSeen сохранился
      expect(dti?.lastSeen).not.toBe(initialTimestamp); // lastSeen обновился
      expect(dti?.confidenceScore).toBeGreaterThanOrEqual(75);
      expect(dti?.trendStatus).toBe('VIRAL');

      // 'old_fading_meme' не был обнаружен в текущем цикле -> затухание (confidenceScore снижен, статус FADING)
      const fading = updated.memes.find((m) => m.id === 'old_fading_meme');
      expect(fading).toBeDefined();
      expect(fading?.firstSeen).toBe(initialTimestamp);
      expect(fading?.confidenceScore).toBe(20); // 35 - 15 decayStep
      expect(fading?.trendStatus).toBe('FADING');
    });
  });

  describe('4. Интеграция с YouTubeShortsAnalyzer', () => {
    it('должен динамически загружать мемы из data/dynamic_memes.json в YouTubeShortsAnalyzer', () => {
      const dynamicData: DynamicMemesData = {
        updatedAt: new Date().toISOString(),
        totalMemes: 1,
        memes: [
          {
            id: 'dress_to_impress',
            name: 'Dress To Impress / DTI Fashion',
            keywords: ['dress to impress', 'dti'],
            regexPattern: '(?:dress\\s*to\\s*impress|dti\\s*fashion)',
            associatedArchetypes: ['SIMULATION_INCREMENTAL'],
            confidenceScore: 92,
            firstSeen: '2026-09-01T12:00:00Z',
            lastSeen: new Date().toISOString(),
            trendStatus: 'VIRAL',
            sources: ['youtube_autocomplete', 'reddit_buzz'],
          },
        ],
      };

      fs.mkdirSync(path.dirname(testStorageFile), { recursive: true });
      fs.writeFileSync(testStorageFile, JSON.stringify(dynamicData, null, 2), 'utf-8');

      // Создаем YouTubeShortsAnalyzer с указанием dynamicMemesPath
      const analyzer = new YouTubeShortsAnalyzer({
        dynamicMemesPath: testStorageFile,
      });

      // Базовые мемы + 1 динамический
      const defs = analyzer.getMemeDefinitions();
      expect(defs.length).toBeGreaterThanOrEqual(5);

      const dtiDef = defs.find((d) => d.id === 'dress_to_impress');
      expect(dtiDef).toBeDefined();
      expect(dtiDef?.name).toContain('Dress To Impress');
      expect(dtiDef?.associatedArchetypes).toContain('SIMULATION_INCREMENTAL');

      // Проверяем детекцию в detectViralMemes
      const sampleShorts = [
        {
          id: 'v_dti_1',
          title: 'NEW DRESS TO IMPRESS SUMMER DRESS! #shorts',
          description: 'Testing the runway outfit in DTI fashion',
          viewCount: 4500000,
          url: 'https://youtube.com/shorts/v_dti_1',
        },
      ];

      const detected = analyzer.detectViralMemes(sampleShorts);
      const matchedDti = detected.find((m) => m.memeId === 'dress_to_impress');
      expect(matchedDti).toBeDefined();
      expect(matchedDti?.occurrences).toBe(1);
      expect(matchedDti?.totalViews).toBe(4500000);
      expect(matchedDti?.viralMultiplier).toBeGreaterThanOrEqual(1.5);

      // Проверяем расчет мультипликатора архетипа
      const multiplier = analyzer.calculateViralMultiplier('SIMULATION_INCREMENTAL', detected);
      expect(multiplier).toBeGreaterThanOrEqual(1.5);
    });

    it('должен сохранять 100% обратную совместимость с базовыми темами без файла динамических мемов', () => {
      const analyzer = new YouTubeShortsAnalyzer();
      const defs = analyzer.getMemeDefinitions();
      expect(defs).toHaveLength(4);
      expect(defs.map((d) => d.id)).toEqual(['skibidi', 'digital_circus', 'brainrot', 'steal_an_egg']);

      const topics = analyzer.getTopics();
      expect(topics.length).toBeGreaterThanOrEqual(5);
    });

    it('должен корректно обрабатывать метод loadDynamicMemes() во время выполнения', () => {
      const dynamicData: DynamicMemesData = {
        updatedAt: new Date().toISOString(),
        totalMemes: 1,
        memes: [
          {
            id: 'tungsten_cube',
            name: 'Tungsten Cube',
            keywords: ['tungsten cube'],
            regexPattern: 'tungsten\\s+cube',
            associatedArchetypes: ['PHYSICS_SANDBOX'],
            confidenceScore: 85,
            firstSeen: '2026-09-01T12:00:00Z',
            lastSeen: new Date().toISOString(),
            trendStatus: 'VIRAL',
            sources: ['roblox_ngram'],
          },
        ],
      };

      fs.mkdirSync(path.dirname(testStorageFile), { recursive: true });
      fs.writeFileSync(testStorageFile, JSON.stringify(dynamicData, null, 2), 'utf-8');

      const analyzer = new YouTubeShortsAnalyzer();
      expect(analyzer.getMemeDefinitions()).toHaveLength(4);

      const loaded = analyzer.loadDynamicMemes(testStorageFile);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('tungsten_cube');

      expect(analyzer.getMemeDefinitions()).toHaveLength(5);
      const cubeDef = analyzer.getMemeDefinitions().find((d) => d.id === 'tungsten_cube');
      expect(cubeDef).toBeDefined();
      expect(cubeDef?.associatedArchetypes).toContain('PHYSICS_SANDBOX');
    });

    it('должен безопасно возвращать пустой массив при отсутствии файла или ошибке JSON в loadDynamicMemes', () => {
      const analyzer = new YouTubeShortsAnalyzer();
      const nonExistent = analyzer.loadDynamicMemes('/non/existent/path/memes.json');
      expect(nonExistent).toEqual([]);

      // Файл с битым JSON
      const corruptFile = path.join(testDataDir, 'corrupt.json');
      fs.mkdirSync(testDataDir, { recursive: true });
      fs.writeFileSync(corruptFile, '{ invalid json', 'utf-8');

      const corruptRes = analyzer.loadDynamicMemes(corruptFile);
      expect(corruptRes).toEqual([]);
    });
  });

  describe('5. Вспомогательные методы, граничные случаи и 100% покрытие', () => {
    it('должен корректно нормализовать идентификаторы мемов (normalizeMemeId)', () => {
      const scheduler = new TrendScheduler();
      expect(scheduler.normalizeMemeId('  [UPDATE] Dress To Impress! ✨ ')).toBe('dress_to_impress');
      expect(scheduler.normalizeMemeId('Steal An Egg (Catch & Run)')).toBe('steal_an_egg_catch_run');
      expect(scheduler.normalizeMemeId('Скибиди Туалет 3000')).toBe('скибиди_туалет_3000');
    });

    it('должен генерировать корректные регулярные выражения (generateRegexPattern)', () => {
      const scheduler = new TrendScheduler();
      expect(scheduler.generateRegexPattern([])).toBe('.*');
      expect(scheduler.generateRegexPattern(['skibidi toilet'])).toBe('skibidi\\s+toilet');
      expect(scheduler.generateRegexPattern(['dti', 'dress to impress'])).toBe('(?:dti|dress\\s+to\\s+impress)');
    });

    it('должен обрабатывать отсутствующий или поврежденный файл словаря в loadExistingData', () => {
      const scheduler = new TrendScheduler({ storagePath: path.join(testDataDir, 'missing.json') });
      const emptyData = scheduler.loadExistingData();
      expect(emptyData.totalMemes).toBe(0);
      expect(emptyData.memes).toEqual([]);

      // Битый JSON
      const corruptFile = path.join(testDataDir, 'corrupt_dict.json');
      fs.mkdirSync(testDataDir, { recursive: true });
      fs.writeFileSync(corruptFile, '{ broken', 'utf-8');
      const corruptScheduler = new TrendScheduler({ storagePath: corruptFile });
      const fallbackData = corruptScheduler.loadExistingData();
      expect(fallbackData.totalMemes).toBe(0);
      expect(fallbackData.memes).toEqual([]);
    });

    it('должен удалять затухшие мемы, если их confidenceScore падает ниже minConfidenceThreshold', async () => {
      const initialTimestamp = '2026-09-01T12:00:00.000Z';
      const initialData: DynamicMemesData = {
        updatedAt: initialTimestamp,
        totalMemes: 1,
        memes: [
          {
            id: 'dead_meme',
            name: 'Dead Meme',
            keywords: ['dead meme'],
            regexPattern: 'dead\\s+meme',
            associatedArchetypes: ['OTHER_CASUAL'],
            confidenceScore: 25,
            firstSeen: initialTimestamp,
            lastSeen: initialTimestamp,
            trendStatus: 'FADING',
            sources: ['reddit_buzz'],
          },
        ],
      };

      fs.mkdirSync(testDataDir, { recursive: true });
      fs.writeFileSync(testStorageFile, JSON.stringify(initialData, null, 2), 'utf-8');

      // Пустые источники
      const mockYt = {
        fetchSearchSuggestions: vi.fn().mockResolvedValue([]),
        fetchTrendingGamingVideos: vi.fn().mockResolvedValue([]),
      } as unknown as YouTubeAutocompleteHarvester;

      const mockReddit = {
        harvest: vi.fn().mockResolvedValue({
          collectedAt: new Date().toISOString(),
          totalPostsScanned: 0,
          filteredPostsCount: 0,
          subreddits: [],
          posts: [],
          buzzEntities: [],
          topTrendingEntity: null,
        }),
      } as unknown as RedditBuzzHarvester;

      const mockExtractor = {
        detectTrendsFromDisk: vi.fn().mockReturnValue([]),
        extractTrends: vi.fn().mockReturnValue([]),
      } as unknown as UnsupervisedTrendExtractor;

      const mockRoblox = {
        fetchSort: vi.fn().mockResolvedValue([]),
        fetchAllKeySorts: vi.fn().mockResolvedValue([]),
      } as unknown as RobloxCollector;

      const scheduler = new TrendScheduler({
        storagePath: testStorageFile,
        youtubeHarvester: mockYt,
        redditHarvester: mockReddit,
        trendExtractor: mockExtractor,
        robloxCollector: mockRoblox,
        minConfidenceThreshold: 20,
        decayStep: 10,
        silent: true,
      });

      // 25 - 10 = 15, что < 20 (minConfidenceThreshold) -> мем должен быть удален (pruned)
      const res = await scheduler.run();
      expect(res.memes.find((m) => m.id === 'dead_meme')).toBeUndefined();
      expect(res.totalMemes).toBe(0);
    });

    it('должен поддерживать живой fallback опрос Roblox чартов, если снимков на диске нет', async () => {
      const mockYt = {
        fetchSearchSuggestions: vi.fn().mockResolvedValue([]),
        fetchTrendingGamingVideos: vi.fn().mockResolvedValue([]),
      } as unknown as YouTubeAutocompleteHarvester;

      const mockReddit = {
        harvest: vi.fn().mockResolvedValue({
          collectedAt: new Date().toISOString(),
          totalPostsScanned: 0,
          filteredPostsCount: 0,
          subreddits: [],
          posts: [],
          buzzEntities: [],
          topTrendingEntity: null,
        }),
      } as unknown as RedditBuzzHarvester;

      const mockExtractor = {
        detectTrendsFromDisk: vi.fn().mockReturnValue([]),
        extractTrends: vi.fn().mockReturnValue([
          {
            ngram: 'blade ball',
            type: 'bigram',
            currentFrequency: 4,
            previousFrequency: 0,
            growthVelocity: 4.0,
            totalCCU: 400000,
            archetype: 'ACTION_SHOOTER',
            sampleTitles: ['Blade Ball [UPD]'],
            gameIds: ['g1'],
          },
        ]),
      } as unknown as UnsupervisedTrendExtractor;

      const mockRoblox = {
        fetchSort: vi.fn().mockResolvedValue([
          {
            id: 'g1',
            platform: 'roblox',
            title: 'Blade Ball',
            genre: 'Action',
            archetype: 'ACTION_SHOOTER',
            metricValue: 400000,
            metricType: 'ccu',
            tags: ['pvp'],
            timestamp: new Date().toISOString(),
          },
        ]),
        fetchAllKeySorts: vi.fn().mockResolvedValue([]),
      } as unknown as RobloxCollector;

      const scheduler = new TrendScheduler({
        storagePath: testStorageFile,
        youtubeHarvester: mockYt,
        redditHarvester: mockReddit,
        trendExtractor: mockExtractor,
        robloxCollector: mockRoblox,
        silent: true,
      });

      const res = await scheduler.run();
      expect(mockRoblox.fetchSort).toHaveBeenCalledWith('top-trending');
      const bladeBall = res.memes.find((m) => m.name.toLowerCase().includes('blade ball'));
      expect(bladeBall).toBeDefined();
      expect(bladeBall?.sources).toContain('roblox_ngram');
      expect(bladeBall?.associatedArchetypes).toContain('ACTION_SHOOTER');
    });
  });
});

