import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  DynamicMeme,
  DynamicMemesData,
  GameArchetype,
  MemeSourceType,
  TrendStatus,
  MarketSnapshot,
  NormalizedGame,
} from '../types/index.js';
import { classifyArchetype } from '../analyzer/classifier.js';
import { YouTubeAutocompleteHarvester } from '../collectors/youtube_autocomplete.js';
import { RedditBuzzHarvester, BuzzEntity } from '../collectors/reddit_buzz.js';
import { UnsupervisedTrendExtractor, ExtractedTrend } from '../analyzer/trend_extractor.js';
import { RobloxCollector } from '../collectors/roblox.js';

export type { DynamicMeme, DynamicMemesData, TrendStatus, MemeSourceType };

export interface TrendSchedulerOptions {
  storagePath?: string;
  snapshotsDir?: string;
  youtubeHarvester?: YouTubeAutocompleteHarvester;
  redditHarvester?: RedditBuzzHarvester;
  trendExtractor?: UnsupervisedTrendExtractor;
  robloxCollector?: RobloxCollector;
  minConfidenceThreshold?: number; // default: 20
  decayStep?: number; // default: 10
  silent?: boolean;
}

interface CandidateMeme {
  id: string;
  name: string;
  keywords: Set<string>;
  sources: Set<MemeSourceType>;
  archetypes: Set<GameArchetype>;
  sampleTitles: Set<string>;
  youtubeHits: number;
  redditBuzzScore: number;
  robloxVelocity: number;
  robloxCCU: number;
}

export class TrendScheduler {
  private storagePath: string;
  private snapshotsDir: string;
  private youtubeHarvester: YouTubeAutocompleteHarvester;
  private redditHarvester: RedditBuzzHarvester;
  private trendExtractor: UnsupervisedTrendExtractor;
  private robloxCollector: RobloxCollector;
  private minConfidenceThreshold: number;
  private decayStep: number;
  private silent: boolean;

  constructor(options: TrendSchedulerOptions = {}) {
    this.storagePath = options.storagePath || path.resolve(process.cwd(), 'data', 'dynamic_memes.json');
    this.snapshotsDir = options.snapshotsDir || path.resolve(process.cwd(), 'data', 'snapshots');
    this.youtubeHarvester = options.youtubeHarvester || new YouTubeAutocompleteHarvester();
    this.redditHarvester = options.redditHarvester || new RedditBuzzHarvester();
    this.trendExtractor = options.trendExtractor || new UnsupervisedTrendExtractor();
    this.robloxCollector = options.robloxCollector || new RobloxCollector();
    this.minConfidenceThreshold = options.minConfidenceThreshold ?? 20;
    this.decayStep = options.decayStep ?? 10;
    this.silent = options.silent ?? false;
  }

  getStoragePath(): string {
    return this.storagePath;
  }

  getYoutubeHarvester(): YouTubeAutocompleteHarvester {
    return this.youtubeHarvester;
  }

  getRedditHarvester(): RedditBuzzHarvester {
    return this.redditHarvester;
  }

  getTrendExtractor(): UnsupervisedTrendExtractor {
    return this.trendExtractor;
  }

  getRobloxCollector(): RobloxCollector {
    return this.robloxCollector;
  }

  /**
   * Нормализует строку в уникальный slug-идентификатор мема.
   */
  normalizeMemeId(text: string): string {
    return text
      .toLowerCase()
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\p{Extended_Pictographic}|\uFE0F|\uFE0E/gu, ' ')
      .replace(/[\(\)\[\]|~—–\-:!?,_#@$%\^&*+=`"';\\\/<>«»]/g, ' ')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 50);
  }

  /**
   * Генерирует регулярное выражение для поиска мема в названиях и описаниях.
   */
  generateRegexPattern(keywords: string[]): string {
    const escaped = keywords
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
      .map((k) => k.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'));

    if (escaped.length === 0) return '.*';
    if (escaped.length === 1) return escaped[0];
    return `(?:${escaped.join('|')})`;
  }

  /**
   * Чтение текущего состояния словаря с диска.
   */
  loadExistingData(): DynamicMemesData {
    if (!fs.existsSync(this.storagePath)) {
      return {
        updatedAt: new Date().toISOString(),
        totalMemes: 0,
        memes: [],
      };
    }

    try {
      const raw = fs.readFileSync(this.storagePath, 'utf-8');
      const data = JSON.parse(raw) as DynamicMemesData;
      if (Array.isArray(data?.memes)) {
        return data;
      }
    } catch {
      // Игнорируем сбои парсинга и начинаем с чистого листа
    }

    return {
      updatedAt: new Date().toISOString(),
      totalMemes: 0,
      memes: [],
    };
  }

  /**
   * Оркестрация сбора (YouTube Autocomplete + Reddit Buzz + Roblox N-Gram) и актуализация словаря.
   */
  async run(): Promise<DynamicMemesData> {
    const log = this.silent ? () => {} : console.log;
    log('\n[TrendScheduler] 🚀 Запуск цикла актуализации динамических мемов...');

    const nowIso = new Date().toISOString();
    const existingData = this.loadExistingData();
    const existingMap = new Map<string, DynamicMeme>();
    for (const m of existingData.memes) {
      existingMap.set(m.id, m);
    }

    const candidateMap = new Map<string, CandidateMeme>();

    const getOrCreateCandidate = (rawName: string): CandidateMeme => {
      const id = this.normalizeMemeId(rawName);
      let cand = candidateMap.get(id);
      if (!cand) {
        cand = {
          id,
          name: rawName.trim(),
          keywords: new Set<string>([rawName.trim().toLowerCase()]),
          sources: new Set<MemeSourceType>(),
          archetypes: new Set<GameArchetype>(),
          sampleTitles: new Set<string>(),
          youtubeHits: 0,
          redditBuzzScore: 0,
          robloxVelocity: 0,
          robloxCCU: 0,
        };
        candidateMap.set(id, cand);
      }
      return cand;
    };

    // 1. Источник: YouTube Autocomplete & Invidious Gaming
    try {
      log('  [1/3] Опрос YouTube Search Autocomplete...');
      const suggestions = await this.youtubeHarvester.fetchSearchSuggestions();
      for (const item of suggestions) {
        const text = (item.suffix || item.query || '').trim();
        if (text.length >= 3) {
          const cand = getOrCreateCandidate(text);
          cand.sources.add('youtube_autocomplete');
          cand.keywords.add(text.toLowerCase());
          cand.youtubeHits += 1;
          cand.archetypes.add(classifyArchetype(text));
        }
      }

      // Дополнительно опрашиваем трендовые игровые ролики YouTube
      try {
        const gamingVideos = await this.youtubeHarvester.fetchTrendingGamingVideos();
        for (const v of gamingVideos.slice(0, 10)) {
          if (v.title) {
            const arch = classifyArchetype(v.title);
            for (const cand of candidateMap.values()) {
              if (v.title.toLowerCase().includes(cand.name.toLowerCase())) {
                cand.sources.add('youtube_autocomplete');
                cand.sampleTitles.add(v.title);
                cand.archetypes.add(arch);
              }
            }
          }
        }
      } catch {
        // Игнорируем сетевые ошибки для опционального блока трендов
      }
    } catch (err) {
      log('  [!] YouTube Autocomplete error:', (err as Error).message);
    }

    // 2. Источник: Reddit Buzz
    try {
      log('  [2/3] Сбор вирусных тем Reddit Buzz...');
      const redditReport = await this.redditHarvester.harvest();
      for (const entity of redditReport.buzzEntities) {
        const cand = getOrCreateCandidate(entity.name);
        cand.sources.add('reddit_buzz');
        cand.keywords.add(entity.name.toLowerCase());
        cand.redditBuzzScore = Math.max(cand.redditBuzzScore, entity.buzzScore);
        if (entity.sampleTitles) {
          for (const t of entity.sampleTitles) cand.sampleTitles.add(t);
        }
        cand.archetypes.add(classifyArchetype(entity.name, 'Reddit Buzz', entity.sampleTitles));
      }
    } catch (err) {
      log('  [!] Reddit Buzz error:', (err as Error).message);
    }

    // 3. Источник: Roblox N-Gram Extractor
    try {
      log('  [3/3] Выявление N-грамм и аномалий роста Roblox...');
      // Проверяем снимки с диска
      let extractedTrends: ExtractedTrend[] = [];
      try {
        extractedTrends = this.trendExtractor.detectTrendsFromDisk(this.snapshotsDir);
      } catch {
        extractedTrends = [];
      }

      // Если снимков на диске нет, пробуем живой опрос Roblox чартов
      if (extractedTrends.length === 0) {
        try {
          const robloxGames = await this.robloxCollector.fetchSort('top-trending');
          if (robloxGames.length > 0) {
            const snapshot: MarketSnapshot = {
              id: 'temp_snapshot',
              timestamp: nowIso,
              totalGamesScanned: robloxGames.length,
              platformCounts: { roblox: robloxGames.length, yandex_games: 0, poki: 0, youtube_trends: 0 },
              robloxTotalCCU: robloxGames.reduce((acc, g) => acc + (g.metricValue || 0), 0),
              games: robloxGames,
              verdicts: [],
            };
            extractedTrends = this.trendExtractor.extractTrends(snapshot, null);
          }
        } catch {
          // Игнорируем ошибки Roblox Explore API
        }
      }

      for (const trend of extractedTrends) {
        const cand = getOrCreateCandidate(trend.ngram);
        cand.sources.add('roblox_ngram');
        cand.keywords.add(trend.ngram.toLowerCase());
        cand.robloxVelocity = Math.max(cand.robloxVelocity, trend.growthVelocity);
        cand.robloxCCU = Math.max(cand.robloxCCU, trend.totalCCU);
        cand.archetypes.add(trend.archetype);
        if (trend.sampleTitles) {
          for (const t of trend.sampleTitles) cand.sampleTitles.add(t);
        }
      }
    } catch (err) {
      log('  [!] Roblox N-Gram error:', (err as Error).message);
    }

    // Синтез кандидатов и расчет confidenceScore / trendStatus
    const updatedMemesMap = new Map<string, DynamicMeme>();

    for (const cand of candidateMap.values()) {
      if (cand.sources.size === 0) continue;

      const existing = existingMap.get(cand.id);
      const allSources = existing
        ? new Set<MemeSourceType>([...existing.sources, ...cand.sources])
        : new Set<MemeSourceType>(cand.sources);

      let score = 20;

      // Вклад YouTube
      if (allSources.has('youtube_autocomplete')) {
        score += Math.min(25, 15 + cand.youtubeHits * 5);
      }

      // Вклад Reddit
      if (allSources.has('reddit_buzz')) {
        score += Math.min(30, Math.max(15, Math.round(cand.redditBuzzScore / 100)));
      }

      // Вклад Roblox
      if (allSources.has('roblox_ngram')) {
        score += Math.min(30, Math.round(cand.robloxVelocity * 8) + Math.min(15, Math.round(cand.robloxCCU / 50000)));
      }

      // Бонус кросс-валидации между независимыми источниками
      if (allSources.size === 2) {
        score += 25;
      } else if (allSources.size >= 3) {
        score += 40;
      }

      // Бонус за удержание (Retention) при подтверждении существующего тренда
      if (existing) {
        score += 10;
      }

      const confidenceScore = Math.min(100, Math.max(20, Math.round(score)));

      const associatedArchetypes: GameArchetype[] = Array.from(cand.archetypes).filter(
        (a) => a !== 'OTHER_CASUAL'
      );
      if (associatedArchetypes.length === 0) {
        if (existing?.associatedArchetypes?.length) {
          associatedArchetypes.push(...existing.associatedArchetypes);
        } else {
          associatedArchetypes.push('OTHER_CASUAL');
        }
      }

      const firstSeen = existing ? existing.firstSeen : nowIso;
      const lastSeen = nowIso;

      let trendStatus: TrendStatus = 'EMERGING';
      if (confidenceScore >= 75 || allSources.size >= 3) {
        trendStatus = 'VIRAL';
      } else if (existing && (existing.trendStatus === 'VIRAL' || existing.trendStatus === 'STABLE') && confidenceScore >= 50) {
        trendStatus = 'STABLE';
      } else if (confidenceScore >= 40) {
        trendStatus = 'EMERGING';
      }

      const allKeywords = new Set([
        ...Array.from(cand.keywords),
        ...(existing?.keywords || []),
      ]);

      const regexPattern = this.generateRegexPattern(Array.from(allKeywords));

      const dynamicMeme: DynamicMeme = {
        id: cand.id,
        name: cand.name,
        keywords: Array.from(allKeywords),
        regexPattern,
        associatedArchetypes,
        confidenceScore,
        firstSeen,
        lastSeen,
        trendStatus,
        sources: Array.from(allSources),
        sampleTitles: Array.from(cand.sampleTitles).slice(0, 5),
      };

      updatedMemesMap.set(cand.id, dynamicMeme);
    }

    // Обработка затухания для мемов, отсутствующих в текущем цикле
    for (const [id, existing] of existingMap.entries()) {
      if (!updatedMemesMap.has(id)) {
        const decayedScore = Math.max(0, existing.confidenceScore - this.decayStep);
        if (decayedScore >= this.minConfidenceThreshold) {
          updatedMemesMap.set(id, {
            ...existing,
            confidenceScore: decayedScore,
            trendStatus: 'FADING',
          });
        }
      }
    }

    const memesArray = Array.from(updatedMemesMap.values()).sort(
      (a, b) => b.confidenceScore - a.confidenceScore
    );

    const resultData: DynamicMemesData = {
      updatedAt: nowIso,
      totalMemes: memesArray.length,
      memes: memesArray,
    };

    // Сохранение на диск
    fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });
    fs.writeFileSync(this.storagePath, JSON.stringify(resultData, null, 2), 'utf-8');

    log(`[TrendScheduler] ✅ Успешно актуализировано ${memesArray.length} мемов в ${this.storagePath}`);

    return resultData;
  }
}

// Запуск напрямую через CLI (tsx src/cron/trend_scheduler.ts)
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const scheduler = new TrendScheduler();
  scheduler
    .run()
    .then((res) => {
      console.log(`\n🎉 Сбор трендов завершен! Всего мемов в словаре: ${res.totalMemes}`);
    })
    .catch((err) => {
      console.error('[TrendScheduler] Фатальная ошибка:', err);
      process.exit(1);
    });
}
