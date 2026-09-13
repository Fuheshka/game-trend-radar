import { GameArchetype, NormalizedGame, ShortsVideoItem, DetectedMemeTrend } from '../types/index.js';
import { classifyArchetype } from '../analyzer/classifier.js';

export interface ViralTrendTopic {
  keyword: string;
  archetype: string;
  viralScore: number; // 0 - 100
  estimatedViewsTier: '100M+' | '50M+' | '10M+' | '1M+';
  hookDescription: string;
}

export interface MemeDefinition {
  id: string;
  name: string;
  regex: RegExp;
  associatedArchetypes: GameArchetype[];
}

export const VIRAL_MEME_DEFINITIONS: MemeDefinition[] = [
  {
    id: 'skibidi',
    name: 'Skibidi Toilet / Cameraman',
    regex: /(?:skibidi|скибиди|cameraman|speakerman|tv\s*man)/i,
    associatedArchetypes: ['SIMULATION_INCREMENTAL', 'ACTION_SHOOTER', 'PHYSICS_SANDBOX'],
  },
  {
    id: 'digital_circus',
    name: 'The Amazing Digital Circus',
    regex: /(?:digital\s*circus|цифровой\s*цирк|pomni|помни|jax|джакс|caine|ragatha)/i,
    associatedArchetypes: ['SURVIVAL_HORROR', 'SIMULATION_INCREMENTAL', 'OTHER_CASUAL'],
  },
  {
    id: 'brainrot',
    name: 'Brainrot / Sigma / Rizz Culture',
    regex: /(?:brainrot|брейнрот|rizz|sigma|сигма|gyatt|fanum\s*tax|mewing|gigachad|baby\s*gronk)/i,
    associatedArchetypes: ['SIMULATION_INCREMENTAL', 'PHYSICS_SANDBOX', 'OTHER_CASUAL'],
  },
  {
    id: 'steal_an_egg',
    name: 'Steal An Egg / Catch & Run',
    regex: /(?:steal\s*an?\s*egg|укради\s*яйц|catch\s*(?:&|and)\s*run|steal\s*egg)/i,
    associatedArchetypes: ['SIMULATION_INCREMENTAL', 'SURVIVAL_HORROR'],
  },
];

export interface YouTubeShortsAnalyzerOptions {
  apiKey?: string;
  invidiousInstances?: string[];
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export class YouTubeShortsAnalyzer {
  private apiKey?: string;
  private invidiousInstances: string[];
  private fetchFn: typeof fetch;
  private timeoutMs: number;

  // Curated baseline topics (fallback when external API is unreachable or offline)
  private viralTopics: ViralTrendTopic[] = [
    {
      keyword: 'Steal An Egg / Catch & Run',
      archetype: 'SIMULATION_INCREMENTAL',
      viralScore: 98,
      estimatedViewsTier: '100M+',
      hookDescription: 'Напряженная кража яйца у спящего монстра и мгновенный побег в безопасную зону.',
    },
    {
      keyword: 'Ragdoll Dismount / Break Bones',
      archetype: 'PHYSICS_SANDBOX',
      viralScore: 94,
      estimatedViewsTier: '100M+',
      hookDescription: 'Эпичные падения рэгдолла с гигантских лестниц с рентген-счетчиком переломов.',
    },
    {
      keyword: '+1 Size / Power Evolution Every Second',
      archetype: 'SIMULATION_INCREMENTAL',
      viralScore: 91,
      estimatedViewsTier: '50M+',
      hookDescription: 'Персонаж растет в размерах каждую секунду и ломает стены вселенского масштаба.',
    },
    {
      keyword: '99 Nights in the Dark Forest',
      archetype: 'SURVIVAL_HORROR',
      viralScore: 88,
      estimatedViewsTier: '50M+',
      hookDescription: 'Выживание у костра с ограниченным запасом дерева и пугающими криками из темноты.',
    },
    {
      keyword: 'Satisfying Sorting & Merge',
      archetype: 'MERGE_IDLE',
      viralScore: 82,
      estimatedViewsTier: '50M+',
      hookDescription: 'Идеальная раскладка товаров по полочкам и гипнотический звук щелчков.',
    },
  ];

  constructor(options: YouTubeShortsAnalyzerOptions = {}) {
    this.apiKey = options.apiKey || process.env.YOUTUBE_API_KEY;
    this.invidiousInstances = options.invidiousInstances || [
      'https://inv.tux.pizza',
      'https://invidious.nerdvpn.de',
      'https://invidious.jing.rocks',
      'https://vid.puffyan.us',
    ];
    this.fetchFn = options.fetchFn || globalThis.fetch;
    this.timeoutMs = options.timeoutMs || 6000;
  }

  /**
   * Сбор среза видео по тегу (#shorts, #roblox, #gamedev) через Invidious API или YouTube Data API v3.
   */
  async fetchTagSlice(tag: string, options: { limit?: number } = {}): Promise<ShortsVideoItem[]> {
    const limit = options.limit || 20;

    // 1. Попытка через официальный YouTube Data API v3 (если указан API-ключ)
    if (this.apiKey) {
      try {
        const ytResults = await this.fetchFromYouTubeApi(tag, limit);
        if (ytResults.length > 0) return ytResults;
      } catch (err) {
        console.warn(`[YouTubeShortsAnalyzer] YouTube Data API error for ${tag}:`, err);
      }
    }

    // 2. Опрос публичных Invidious/Piped API инстансов
    for (const instance of this.invidiousInstances) {
      try {
        const items = await this.fetchFromInvidiousInstance(instance, tag, limit);
        if (items.length > 0) return items;
      } catch {
        // Пробуем следующий инстанс при недоступности
        continue;
      }
    }

    return [];
  }

  private async fetchFromInvidiousInstance(
    instance: string,
    tag: string,
    limit: number
  ): Promise<ShortsVideoItem[]> {
    const cleanTag = tag.trim();
    const query = encodeURIComponent(cleanTag);
    const url = `${instance}/api/v1/search?q=${query}&type=video&sort_by=view_count`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchFn(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(`Invidious HTTP ${res.status}`);
      }

      const data = (await res.json()) as any;
      const rawList = Array.isArray(data) ? data : data.items || [];

      return rawList.slice(0, limit).map((v: any): ShortsVideoItem => {
        const id = String(v.videoId || v.id || Math.random().toString(36).substring(2, 9));
        return {
          id,
          title: String(v.title || ''),
          description: String(v.description || v.shortDescription || ''),
          viewCount: Number(v.viewCount || v.views || 0),
          publishedAt: v.published ? new Date(v.published * 1000).toISOString() : undefined,
          url: `https://www.youtube.com/shorts/${id}`,
          channelTitle: String(v.author || v.uploaderName || ''),
          matchedTags: [cleanTag],
        };
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async fetchFromYouTubeApi(tag: string, limit: number): Promise<ShortsVideoItem[]> {
    const cleanTag = tag.trim();
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short&q=${encodeURIComponent(cleanTag)}&maxResults=${Math.min(limit, 50)}&key=${this.apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchFn(searchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`YouTube API HTTP ${res.status}`);

      const data = (await res.json()) as any;
      const searchItems = data.items || [];
      const videoIds = searchItems.map((item: any) => item.id?.videoId).filter(Boolean);

      if (videoIds.length === 0) return [];

      // Запрос статистики (просмотров) для найденных роликов
      const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds.join(',')}&key=${this.apiKey}`;
      const statsRes = await this.fetchFn(statsUrl);
      const statsData = statsRes.ok ? await statsRes.json() : { items: [] };
      const statsMap = new Map<string, number>();

      for (const item of statsData.items || []) {
        statsMap.set(item.id, Number(item.statistics?.viewCount || 0));
      }

      return searchItems.map((v: any): ShortsVideoItem => {
        const vidId = v.id?.videoId || '';
        return {
          id: vidId,
          title: v.snippet?.title || '',
          description: v.snippet?.description || '',
          viewCount: statsMap.get(vidId) || 0,
          publishedAt: v.snippet?.publishedAt,
          url: `https://www.youtube.com/shorts/${vidId}`,
          channelTitle: v.snippet?.channelTitle || '',
          matchedTags: [cleanTag],
        };
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Сбор видео по набору целевых тегов (#shorts, #roblox, #gamedev) с дедупликацией по ID.
   */
  async scanTrendingSlices(
    tags: string[] = ['#shorts', '#roblox', '#gamedev'],
    options: { limitPerTag?: number } = {}
  ): Promise<ShortsVideoItem[]> {
    const limitPerTag = options.limitPerTag || 20;
    const slices = await Promise.all(
      tags.map(async (tag) => {
        try {
          return await this.fetchTagSlice(tag, { limit: limitPerTag });
        } catch {
          return [];
        }
      })
    );

    const dedupMap = new Map<string, ShortsVideoItem>();
    for (const list of slices) {
      for (const video of list) {
        if (!dedupMap.has(video.id)) {
          dedupMap.set(video.id, { ...video });
        } else {
          const existing = dedupMap.get(video.id)!;
          if (video.matchedTags && existing.matchedTags) {
            for (const t of video.matchedTags) {
              if (!existing.matchedTags.includes(t)) existing.matchedTags.push(t);
            }
          }
        }
      }
    }

    return Array.from(dedupMap.values());
  }

  /**
   * Детекция быстрорастущих вирусных персонажей и мемов (Skibidi, Digital Circus, Brainrot, Steal An Egg).
   */
  detectViralMemes(videos: ShortsVideoItem[]): DetectedMemeTrend[] {
    const totalScanned = Math.max(1, videos.length);

    return VIRAL_MEME_DEFINITIONS.map((def) => {
      const matchingVideos = videos.filter((v) => {
        const text = `${v.title} ${v.description}`;
        return def.regex.test(text);
      });

      const occurrences = matchingVideos.length;
      const totalViews = matchingVideos.reduce((acc, v) => acc + (v.viewCount || 0), 0);
      const avgViews = occurrences > 0 ? Math.round(totalViews / occurrences) : 0;

      // Расчет коэффициента вирусного ускорения для мема
      let viralMultiplier = 1.0;
      if (occurrences > 0) {
        viralMultiplier = 1.15;
        // Буст за частоту упоминания в выборке
        const frequencyRatio = occurrences / totalScanned;
        viralMultiplier += Math.min(0.45, frequencyRatio * 1.5);

        // Буст за среднее число просмотров
        if (avgViews >= 2_000_000) viralMultiplier += 0.5;
        else if (avgViews >= 500_000) viralMultiplier += 0.35;
        else if (avgViews >= 100_000) viralMultiplier += 0.2;
        else if (avgViews >= 20_000) viralMultiplier += 0.1;
      }

      viralMultiplier = Number(Math.min(2.5, Math.max(1.0, viralMultiplier)).toFixed(2));

      // Топ-3 заголовка роликов по просмотрам
      const sampleTitles = matchingVideos
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, 3)
        .map((v) => v.title);

      return {
        memeId: def.id,
        name: def.name,
        pattern: def.regex.source,
        occurrences,
        totalViews,
        avgViews,
        viralMultiplier,
        sampleTitles,
      };
    });
  }

  /**
   * Расчет коэффициента вирусного ускорения (Viral Multiplier) для архетипа игры.
   */
  calculateViralMultiplier(archetype: GameArchetype, detectedMemes: DetectedMemeTrend[]): number {
    const relevantMemes = detectedMemes.filter((m) => {
      const def = VIRAL_MEME_DEFINITIONS.find((d) => d.id === m.memeId);
      return def?.associatedArchetypes.includes(archetype) && m.occurrences > 0;
    });

    if (relevantMemes.length === 0) {
      return 1.0;
    }

    const topMultiplier = Math.max(...relevantMemes.map((m) => m.viralMultiplier));
    const extraBoost = Math.min(0.3, (relevantMemes.length - 1) * 0.1);
    const finalMultiplier = Number((topMultiplier + extraBoost).toFixed(2));
    return Math.min(2.5, Math.max(1.0, finalMultiplier));
  }

  /**
   * Общий рыночный Viral Multiplier по всем найденным трендам.
   */
  getOverallViralMultiplier(detectedMemes: DetectedMemeTrend[]): number {
    const activeMemes = detectedMemes.filter((m) => m.occurrences > 0);
    if (activeMemes.length === 0) return 1.0;

    const avg = activeMemes.reduce((sum, m) => sum + m.viralMultiplier, 0) / activeMemes.length;
    return Number(Math.min(2.5, Math.max(1.0, avg)).toFixed(2));
  }

  /**
   * Возвращает нормализованные игры/тренды для общей шины радара.
   * При сбоях сети бесшовно переключается на курируемые темы.
   */
  async getViralShortsTrends(options: { live?: boolean; tags?: string[] } = {}): Promise<NormalizedGame[]> {
    const now = new Date().toISOString();
    const live = options.live !== false; // по умолчанию пытаемся получить живой срез

    if (live) {
      try {
        const videos = await this.scanTrendingSlices(options.tags || ['#shorts', '#roblox', '#gamedev'], {
          limitPerTag: 15,
        });

        if (videos.length > 0) {
          return videos.slice(0, 10).map((v, idx) => {
            const archetype = classifyArchetype(v.title, 'Shorts Viral', v.matchedTags || []);
            // Нормализуем вирусный балл по просмотрам от 70 до 99
            let viralScore = 70;
            if (v.viewCount > 5_000_000) viralScore = 99;
            else if (v.viewCount > 1_000_000) viralScore = 94;
            else if (v.viewCount > 200_000) viralScore = 88;
            else if (v.viewCount > 50_000) viralScore = 80;

            return {
              id: `yt_shorts_live_${v.id || idx + 1}`,
              platform: 'youtube_trends',
              title: v.title,
              genre: 'Viral Short Format',
              archetype,
              metricValue: viralScore,
              metricType: 'viral_score',
              tags: ['youtube_shorts', 'live_scan', ...(v.matchedTags || [])],
              url: v.url,
              timestamp: now,
            };
          });
        }
      } catch (err) {
        console.warn('[YouTubeShortsAnalyzer] Live scan fallback triggered:', err);
      }
    }

    // Fallback на курируемый датасет
    return this.viralTopics.map((item, idx) => ({
      id: `yt_shorts_${idx + 1}`,
      platform: 'youtube_trends',
      title: item.keyword,
      genre: 'Viral Short Format',
      archetype: classifyArchetype(item.keyword, item.archetype),
      metricValue: item.viralScore,
      metricType: 'viral_score',
      tags: ['youtube_shorts', 'viral', item.estimatedViewsTier],
      url: `https://www.youtube.com/hashtag/${encodeURIComponent(item.keyword.split(' ')[0].toLowerCase())}`,
      timestamp: now,
    }));
  }

  getTopics(): ViralTrendTopic[] {
    return this.viralTopics;
  }
}
