/**
 * YouTube Autocomplete & Invidious Gaming Harvester
 * Автоматический сбор поисковых запросов пользователей через YouTube Search Autocomplete API
 * и суточных игровых трендов Invidious Gaming без ручного ввода ключевых слов.
 */

export const DEFAULT_SEARCH_PREFIXES: string[] = [
  'roblox ',
  'shorts roblox ',
  'роблокс ',
  'game dev shorts ',
  'simulator roblox ',
];

export const DEFAULT_INVIDIOUS_INSTANCES: string[] = [
  'https://inv.tux.pizza',
  'https://invidious.nerdvpn.de',
  'https://invidious.jing.rocks',
  'https://vid.puffyan.us',
  'https://invidious.drgns.space',
];

export interface AutocompleteSuggestion {
  query: string;
  prefix: string;
  suffix: string;
}

export interface TrendingGamingVideo {
  id: string;
  title: string;
  description: string;
  viewCount: number;
  author: string;
  url: string;
  published?: number;
  publishedAt?: string;
  thumbnailUrl?: string;
}

export interface YouTubeAutocompleteOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  invidiousInstances?: string[];
  suggestBaseUrl?: string;
}

export class YouTubeAutocompleteHarvester {
  private fetchFn: typeof fetch;
  private timeoutMs: number;
  private invidiousInstances: string[];
  private suggestBaseUrl: string;

  constructor(options: YouTubeAutocompleteOptions = {}) {
    this.fetchFn = options.fetchFn || globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.invidiousInstances = options.invidiousInstances && options.invidiousInstances.length > 0
      ? options.invidiousInstances
      : DEFAULT_INVIDIOUS_INSTANCES;
    this.suggestBaseUrl = options.suggestBaseUrl || 'https://suggestqueries.google.com/complete/search';
  }

  getTimeoutMs(): number {
    return this.timeoutMs;
  }

  getInvidiousInstances(): string[] {
    return [...this.invidiousInstances];
  }

  /**
   * Сбор поисковых подсказок по заданным префиксам через YouTube suggestqueries API.
   * Парсит JSON/JSONP, очищает HTML-теги, нормализует и дедуплицирует запросы с выделением суффиксов.
   */
  async fetchSearchSuggestions(
    prefixes: string[] = DEFAULT_SEARCH_PREFIXES
  ): Promise<AutocompleteSuggestion[]> {
    const targetPrefixes = prefixes && prefixes.length > 0 ? prefixes : DEFAULT_SEARCH_PREFIXES;
    const seenQueries = new Set<string>();
    const results: AutocompleteSuggestion[] = [];

    for (const prefix of targetPrefixes) {
      try {
        const rawQueries = await this.fetchSinglePrefix(prefix);
        for (const rawQuery of rawQueries) {
          const normalized = rawQuery.trim();
          const lowerKey = normalized.toLowerCase();
          if (!lowerKey || seenQueries.has(lowerKey)) {
            continue;
          }
          seenQueries.add(lowerKey);

          const suffix = this.extractSuffix(normalized, prefix);
          results.push({
            query: normalized,
            prefix,
            suffix,
          });
        }
      } catch {
        // Отказоустойчивость: продолжаем сбор для остальных префиксов
        continue;
      }
    }

    return results;
  }

  /**
   * Запрос к API подсказок для одного префикса с таймаутом AbortController.
   */
  private async fetchSinglePrefix(prefix: string): Promise<string[]> {
    const url = `${this.suggestBaseUrl}?client=youtube&ds=yt&q=${encodeURIComponent(prefix)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        signal: controller.signal,
        headers: {
          'Accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return [];
      }

      const text = await response.text();
      return this.parseSuggestionsResponse(text);
    } catch {
      clearTimeout(timeoutId);
      return [];
    }
  }

  /**
   * Парсинг ответа YouTube Autocomplete (чистый JSON или JSONP обертка window.google.ac.h).
   */
  parseSuggestionsResponse(text: string): string[] {
    if (!text || typeof text !== 'string') return [];

    let cleaned = text.trim();
    // Обработка JSONP: извлечение содержимого между первыми скобками ( ... )
    const firstParen = cleaned.indexOf('(');
    const lastParen = cleaned.lastIndexOf(')');
    if (firstParen !== -1 && lastParen > firstParen) {
      cleaned = cleaned.substring(firstParen + 1, lastParen).trim();
    }

    try {
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed) || !Array.isArray(parsed[1])) {
        return [];
      }

      const rawItems = parsed[1];
      const suggestions: string[] = [];

      for (const item of rawItems) {
        let suggestionStr = '';
        if (typeof item === 'string') {
          suggestionStr = item;
        } else if (Array.isArray(item) && typeof item[0] === 'string') {
          suggestionStr = item[0];
        }

        if (suggestionStr) {
          // Очистка HTML-тегов (например <b>...</b>)
          const sanitized = suggestionStr.replace(/<[^>]*>/g, '').trim();
          if (sanitized) {
            suggestions.push(sanitized);
          }
        }
      }

      return suggestions;
    } catch {
      return [];
    }
  }

  /**
   * Выделение растущего поискового суффикса из полного запроса по отношению к префиксу.
   */
  extractSuffix(query: string, prefix: string): string {
    const trimmedQuery = query.trim();
    const trimmedPrefix = prefix.trim();
    const lowerQuery = trimmedQuery.toLowerCase();
    const lowerPrefix = trimmedPrefix.toLowerCase();

    if (lowerQuery.startsWith(lowerPrefix)) {
      return trimmedQuery.slice(lowerPrefix.length).trim();
    }
    return trimmedQuery;
  }

  /**
   * Сбор суточных игровых трендов через ротацию зеркал Invidious (/api/v1/trending?type=gaming).
   * Извлекает топ-50 игровых видео с таймаутом 5000 мс на зеркало.
   */
  async fetchTrendingGamingVideos(limit: number = 50): Promise<TrendingGamingVideo[]> {
    for (const instance of this.invidiousInstances) {
      const cleanInstance = instance.replace(/\/+$/, '');
      const url = `${cleanInstance}/api/v1/trending?type=gaming`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchFn(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          continue;
        }

        const data = (await response.json()) as any;
        const rawList = Array.isArray(data) ? data : data?.items || [];

        if (rawList.length === 0) {
          continue;
        }

        return rawList.slice(0, limit).map((v: any): TrendingGamingVideo => {
          const videoId = String(v.videoId || v.id || '');
          return {
            id: videoId,
            title: String(v.title || ''),
            description: String(v.description || v.shortDescription || ''),
            viewCount: Number(v.viewCount || v.views || 0),
            author: String(v.author || v.authorTitle || ''),
            url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : String(v.url || ''),
            published: typeof v.published === 'number' ? v.published : undefined,
            publishedAt: v.publishedText ? String(v.publishedText) : undefined,
            thumbnailUrl: v.videoThumbnails?.[0]?.url ? String(v.videoThumbnails[0].url) : undefined,
          };
        });
      } catch {
        clearTimeout(timeoutId);
        // При ошибке или таймауте текущего зеркала переходим к следующему
        continue;
      }
    }

    return [];
  }
}
