/**
 * Reddit JSON API & Social Buzz Harvester
 * Сбор вирусных обсуждений, концептов и игровых мемов из сабреддитов через открытый Reddit JSON API
 * без регистрации платных API-ключей.
 */

export const DEFAULT_REDDIT_SUBREDDITS: string[] = [
  'roblox',
  'RobloxAvatars',
  'gamedev',
  'memes',
];

export const DEFAULT_USER_AGENT = 'GameTrendRadar/1.0.0 (social-buzz-harvester; contact: /u/gametrendradar)';

export interface RedditPost {
  id: string;
  title: string;
  subreddit: string;
  ups: number;
  num_comments: number;
  created_utc: number;
  url: string;
  permalink: string;
  author?: string;
  selftext?: string;
}

export interface BuzzEntity {
  name: string;
  occurrences: number;
  totalUps: number;
  totalComments: number;
  buzzScore: number;
  subreddits: string[];
  sampleTitles: string[];
  samplePostUrls: string[];
}

export interface RedditBuzzReport {
  collectedAt: string;
  totalPostsScanned: number;
  filteredPostsCount: number;
  subreddits: string[];
  posts: RedditPost[];
  buzzEntities: BuzzEntity[];
  topTrendingEntity?: BuzzEntity | null;
}

export interface RedditBuzzOptions {
  fetchFn?: typeof fetch;
  userAgent?: string;
  subreddits?: string[];
  minUps?: number;
  minComments?: number;
  maxAgeHours?: number;
  limit?: number;
  timeoutMs?: number;
}

export interface BuzzScoreParams {
  totalUps: number;
  totalComments: number;
  occurrences: number;
}

const COMMON_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'in', 'for', 'with', 'on', 'at', 'by', 'from',
  'is', 'are', 'was', 'were', 'it', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'their', 'our',
  'what', 'how', 'why', 'who', 'when', 'where', 'which',
  'i', 'me', 'you', 'he', 'she', 'we', 'they', 'them',
  'just', 'like', 'look', 'new', 'do', 'does', 'did', 'have', 'has', 'had', 'can', 'could', 'will', 'would',
  'so', 'if', 'but', 'about', 'into', 'some', 'any', 'no', 'not', 'all', 'out', 'up', 'down', 'get', 'got',
  'be', 'been', 'being', 'there', 'here', 'very', 'much', 'more', 'too', 'also', 'than',
  'of', 'as', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
  'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то', 'все', 'она', 'так', 'его', 'но', 'да', 'ты',
  'к', 'у', 'же', 'вы', 'за', 'бы', 'по', 'только', 'ее', 'мне', 'было', 'вот', 'от', 'меня', 'еще', 'нет', 'о', 'из', 'ему',
]);

export class RedditBuzzHarvester {
  private fetchFn: typeof fetch;
  private userAgent: string;
  private subreddits: string[];
  private minUps: number;
  private minComments: number;
  private maxAgeHours: number;
  private limit: number;
  private timeoutMs: number;

  constructor(options: RedditBuzzOptions = {}) {
    this.fetchFn = options.fetchFn || globalThis.fetch;
    this.userAgent = options.userAgent || DEFAULT_USER_AGENT;
    this.subreddits = this.normalizeSubreddits(options.subreddits || DEFAULT_REDDIT_SUBREDDITS);
    this.minUps = options.minUps ?? 100;
    this.minComments = options.minComments ?? 50;
    this.maxAgeHours = options.maxAgeHours ?? 48;
    this.limit = options.limit ?? 50;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  getSubreddits(): string[] {
    return [...this.subreddits];
  }

  getUserAgent(): string {
    return this.userAgent;
  }

  getMinUps(): number {
    return this.minUps;
  }

  getMinComments(): number {
    return this.minComments;
  }

  getMaxAgeHours(): number {
    return this.maxAgeHours;
  }

  getLimit(): number {
    return this.limit;
  }

  /**
   * Нормализует список имен сабреддитов, удаляя префиксы r/, /r/ и концевые слэши.
   */
  private normalizeSubreddits(subs: string[]): string[] {
    return subs
      .map(s => s.trim().replace(/^\/?r\//i, '').replace(/\/+$/, ''))
      .filter(s => s.length > 0);
  }

  /**
   * Запрос к Reddit JSON API: https://www.reddit.com/r/{subreddit}/hot.json?limit={limit}
   */
  async fetchSubredditPosts(subreddit: string): Promise<RedditPost[]> {
    const cleanSub = subreddit.trim().replace(/^\/?r\//i, '').replace(/\/+$/, '');
    const url = `https://www.reddit.com/r/${cleanSub}/hot.json?limit=${this.limit}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      if (!data || !data.data || !Array.isArray(data.data.children)) {
        return [];
      }

      const posts: RedditPost[] = [];
      for (const item of data.data.children) {
        if (!item || !item.data) continue;
        const postData = item.data;
        posts.push({
          id: String(postData.id || ''),
          title: String(postData.title || '').trim(),
          subreddit: String(postData.subreddit || cleanSub),
          ups: Number(postData.ups ?? postData.score ?? 0),
          num_comments: Number(postData.num_comments ?? 0),
          created_utc: Number(postData.created_utc ?? 0),
          url: String(postData.url || ''),
          permalink: String(postData.permalink || ''),
          author: postData.author ? String(postData.author) : undefined,
          selftext: postData.selftext ? String(postData.selftext) : undefined,
        });
      }

      return posts;
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Фильтрация: отбор постов с ups > 100 ИЛИ num_comments > 50 за последние 48 часов.
   */
  isViralPost(post: RedditPost, nowMs: number = Date.now()): boolean {
    if (!post || !post.created_utc) return false;

    const ageHours = (nowMs - post.created_utc * 1000) / (3600 * 1000);
    const isWithinTimeWindow = ageHours >= 0 && ageHours <= this.maxAgeHours;

    if (!isWithinTimeWindow) {
      return false;
    }

    return post.ups > this.minUps || post.num_comments > this.minComments;
  }

  /**
   * Очищает текст и извлекает ключевые слова и N-граммы (биграммы, триграммы).
   */
  extractKeywords(title: string): string[] {
    if (!title) return [];

    // Очистка от эмодзи, рекламы и спецсимволов
    const cleaned = title
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\p{Extended_Pictographic}|\uFE0F|\uFE0E/gu, ' ')
      .replace(/[\(\)\[\]|~—–\-:!?,_#@$%\^&*+=`"';\\\/<>«»]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if (!cleaned) return [];

    const rawWords = cleaned.split(/\s+/).filter(w => w.length > 0);
    const entities = new Set<string>();

    // 1. Одиночные значимые слова (длина >= 3, не стоп-слова, не чисто числа)
    for (const w of rawWords) {
      if (w.length >= 3 && !COMMON_STOP_WORDS.has(w) && !/^\d+$/.test(w)) {
        entities.add(w);
      }
    }

    // 2. Биграммы (2 слова подряд)
    for (let i = 0; i < rawWords.length - 1; i++) {
      const w1 = rawWords[i];
      const w2 = rawWords[i + 1];
      // Биграмма включается, если хотя бы одно из слов значимо и не состоит из цифр
      if ((!COMMON_STOP_WORDS.has(w1) || !COMMON_STOP_WORDS.has(w2)) && !/^\d+$/.test(w1) && !/^\d+$/.test(w2)) {
        // Не начинаем и не заканчиваем стоп-словом биграмму
        if (!COMMON_STOP_WORDS.has(w1) && !COMMON_STOP_WORDS.has(w2)) {
          entities.add(`${w1} ${w2}`);
        }
      }
    }

    // 3. Триграммы (3 слова подряд) - полезно для конструкций вроде "dress to impress"
    for (let i = 0; i < rawWords.length - 2; i++) {
      const w1 = rawWords[i];
      const w2 = rawWords[i + 1];
      const w3 = rawWords[i + 2];
      // Триграмма включается, если начальное и конечное слово значимы (не стоп-слова)
      if (!COMMON_STOP_WORDS.has(w1) && !COMMON_STOP_WORDS.has(w3)) {
        entities.add(`${w1} ${w2} ${w3}`);
      }
    }

    return Array.from(entities);
  }

  /**
   * Расчет показателя Buzz Score (социальный резонанс):
   * Учитывает количество апвоутов, комментариев (с повышенным весом) и повторение темы.
   */
  calculateBuzzScore(params: BuzzScoreParams): number {
    const { totalUps, totalComments, occurrences } = params;
    // Комментарии отражают активное участие комьюнити, дискуссии и споры
    const engagementBase = totalUps + totalComments * 2;
    // Повторяемость сущности в разных постах усиливает резонанс
    const repetitionMultiplier = 1 + Math.log2(Math.max(1, occurrences));
    return Math.round(engagementBase * repetitionMultiplier);
  }

  /**
   * Извлекает повторяющиеся ключевые сущности из массива постов и сортирует по Buzz Score.
   */
  extractBuzzEntities(
    posts: RedditPost[],
    options?: { minOccurrences?: number }
  ): BuzzEntity[] {
    const minOccurrences = options?.minOccurrences ?? 1;

    interface EntityTracker {
      name: string;
      postIds: Set<string>;
      totalUps: number;
      totalComments: number;
      subreddits: Set<string>;
      sampleTitles: Set<string>;
      samplePostUrls: Set<string>;
    }

    const trackerMap = new Map<string, EntityTracker>();

    for (const post of posts) {
      const keywords = this.extractKeywords(post.title);
      for (const kw of keywords) {
        let entry = trackerMap.get(kw);
        if (!entry) {
          entry = {
            name: kw,
            postIds: new Set<string>(),
            totalUps: 0,
            totalComments: 0,
            subreddits: new Set<string>(),
            sampleTitles: new Set<string>(),
            samplePostUrls: new Set<string>(),
          };
          trackerMap.set(kw, entry);
        }

        if (!entry.postIds.has(post.id)) {
          entry.postIds.add(post.id);
          entry.totalUps += post.ups;
          entry.totalComments += post.num_comments;
          entry.subreddits.add(post.subreddit);
          if (entry.sampleTitles.size < 5) {
            entry.sampleTitles.add(post.title);
          }
          if (entry.samplePostUrls.size < 5) {
            entry.samplePostUrls.add(post.permalink ? `https://reddit.com${post.permalink}` : post.url);
          }
        }
      }
    }

    const entities: BuzzEntity[] = [];

    for (const entry of trackerMap.values()) {
      const occurrences = entry.postIds.size;
      if (occurrences < minOccurrences) continue;

      const buzzScore = this.calculateBuzzScore({
        totalUps: entry.totalUps,
        totalComments: entry.totalComments,
        occurrences,
      });

      entities.push({
        name: entry.name,
        occurrences,
        totalUps: entry.totalUps,
        totalComments: entry.totalComments,
        buzzScore,
        subreddits: Array.from(entry.subreddits),
        sampleTitles: Array.from(entry.sampleTitles),
        samplePostUrls: Array.from(entry.samplePostUrls),
      });
    }

    // Сортировка по убыванию Buzz Score
    entities.sort((a, b) => b.buzzScore - a.buzzScore);

    return entities;
  }

  /**
   * Комплексный сбор вирусных постов и мемов из всех настроенных сабреддитов.
   */
  async harvest(): Promise<RedditBuzzReport> {
    const nowMs = Date.now();
    let totalPostsScanned = 0;
    const allFilteredPosts: RedditPost[] = [];

    for (const sub of this.subreddits) {
      const posts = await this.fetchSubredditPosts(sub);
      totalPostsScanned += posts.length;

      for (const post of posts) {
        if (this.isViralPost(post, nowMs)) {
          allFilteredPosts.push(post);
        }
      }
    }

    const buzzEntities = this.extractBuzzEntities(allFilteredPosts);
    const topTrendingEntity = buzzEntities.length > 0 ? buzzEntities[0] : null;

    return {
      collectedAt: new Date(nowMs).toISOString(),
      totalPostsScanned,
      filteredPostsCount: allFilteredPosts.length,
      subreddits: [...this.subreddits],
      posts: allFilteredPosts,
      buzzEntities,
      topTrendingEntity,
    };
  }
}
