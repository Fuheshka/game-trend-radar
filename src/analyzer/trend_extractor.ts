import * as fs from 'node:fs';
import * as path from 'node:path';
import { GameArchetype, MarketSnapshot, NormalizedGame } from '../types/index.js';
import { classifyArchetype } from './classifier.js';

export interface ExtractedTrend {
  ngram: string;
  type: 'bigram' | 'trigram';
  currentFrequency: number;
  previousFrequency: number;
  growthVelocity: number;
  totalCCU: number;
  archetype: GameArchetype;
  sampleTitles: string[];
  gameIds: string[];
}

export interface TrendExtractorOptions {
  minGames?: number;
  minGrowthRatio?: number;
}

interface NgramGameMatch {
  gameId: string;
  title: string;
  ccu: number;
  archetype: GameArchetype;
  genre: string;
  tags: string[];
}

interface NgramAggregated {
  ngram: string;
  type: 'bigram' | 'trigram';
  games: NgramGameMatch[];
}

export class UnsupervisedTrendExtractor {
  private minGames: number;
  private minGrowthRatio: number;

  constructor(options?: TrendExtractorOptions) {
    this.minGames = options?.minGames ?? 3;
    this.minGrowthRatio = options?.minGrowthRatio ?? 2.5;
  }

  /**
   * Очищает название от рекламных тегов ([UPDATE], [NEW]), круглых скобок,
   * эмодзи и спецсимволов, приводя к нижнему регистру.
   */
  cleanTitle(rawTitle: string): string {
    if (!rawTitle) return '';

    return rawTitle
      // Удаляем квадратные скобки и рекламные теги внутри них ([UPDATE], [NEW], [X10] и т.д.)
      .replace(/\[[^\]]*\]/g, ' ')
      // Удаляем эмодзи
      .replace(/\p{Extended_Pictographic}|\uFE0F|\uFE0E/gu, ' ')
      // Удаляем круглые скобки, пунктуацию и спецсимволы
      .replace(/[\(\)\[\]|~—–\-:!?,_#@$%\^&*+=`"';\\\/<>«»]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /**
   * Разбивает строку на токены и строит биграммы (2 слова) и триграммы (3 слова).
   */
  extractNgrams(text: string): { bigrams: string[]; trigrams: string[] } {
    const cleaned = this.cleanTitle(text);
    if (!cleaned) return { bigrams: [], trigrams: [] };

    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    const bigrams: string[] = [];
    const trigrams: string[] = [];

    for (let i = 0; i < words.length - 1; i++) {
      bigrams.push(`${words[i]} ${words[i + 1]}`);
    }

    for (let i = 0; i < words.length - 2; i++) {
      trigrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }

    return { bigrams, trigrams };
  }

  /**
   * Агрегирует статистику появления N-грамм по массиву игр.
   */
  private aggregateNgrams(games: NormalizedGame[]): Map<string, NgramAggregated> {
    const map = new Map<string, NgramAggregated>();

    for (const game of games) {
      const { bigrams, trigrams } = this.extractNgrams(game.title);
      const uniqueBigrams = new Set(bigrams);
      const uniqueTrigrams = new Set(trigrams);

      const ccu = game.metricType === 'ccu' ? game.metricValue : 0;

      const recordMatch = (ngram: string, type: 'bigram' | 'trigram') => {
        let entry = map.get(ngram);
        if (!entry) {
          entry = { ngram, type, games: [] };
          map.set(ngram, entry);
        }
        entry.games.push({
          gameId: game.id,
          title: game.title,
          ccu,
          archetype: game.archetype,
          genre: game.genre,
          tags: game.tags,
        });
      };

      for (const b of uniqueBigrams) {
        recordMatch(b, 'bigram');
      }

      for (const t of uniqueTrigrams) {
        recordMatch(t, 'trigram');
      }
    }

    return map;
  }

  /**
   * Определяет наиболее подходящий архетип для N-граммы на основе classifier.ts.
   */
  private resolveArchetype(ngram: string, matches: NgramGameMatch[]): GameArchetype {
    // 1. Прямая классификация самой N-граммы
    const directArchetype = classifyArchetype(ngram);
    if (directArchetype !== 'OTHER_CASUAL') {
      return directArchetype;
    }

    // 2. Определение по доминирующему архетипу игр выборки
    const counts: Record<string, number> = {};
    for (const match of matches) {
      let arch = match.archetype;
      if (arch === 'OTHER_CASUAL') {
        arch = classifyArchetype(match.title, match.genre, match.tags);
      }
      counts[arch] = (counts[arch] || 0) + 1;
    }

    // Исключаем OTHER_CASUAL, если есть более специфичные архетипы
    const sorted = Object.entries(counts).sort((a, b) => {
      if (a[0] === 'OTHER_CASUAL') return 1;
      if (b[0] === 'OTHER_CASUAL') return -1;
      return b[1] - a[1];
    });

    if (sorted.length > 0 && sorted[0][1] > 0) {
      return sorted[0][0] as GameArchetype;
    }

    return 'OTHER_CASUAL';
  }

  /**
   * Сравнивает текущий снимок рынка с предыдущим и выявляет аномалии роста (Velocity Spikes).
   */
  extractTrends(currentSnapshot: MarketSnapshot, previousSnapshot?: MarketSnapshot | null): ExtractedTrend[] {
    const currentMap = this.aggregateNgrams(currentSnapshot.games);
    const previousMap = previousSnapshot ? this.aggregateNgrams(previousSnapshot.games) : new Map<string, NgramAggregated>();

    const trends: ExtractedTrend[] = [];

    for (const [ngram, currentEntry] of currentMap.entries()) {
      const currentFrequency = currentEntry.games.length;
      if (currentFrequency < this.minGames) {
        continue;
      }

      const prevEntry = previousMap.get(ngram);
      const previousFrequency = prevEntry ? prevEntry.games.length : 0;

      const growthVelocity = previousFrequency === 0 ? (currentFrequency >= this.minGames ? currentFrequency : Infinity) : currentFrequency / previousFrequency;

      if (growthVelocity < this.minGrowthRatio) {
        continue;
      }

      const totalCCU = currentEntry.games.reduce((acc, g) => acc + g.ccu, 0);
      const archetype = this.resolveArchetype(ngram, currentEntry.games);
      const sampleTitles = currentEntry.games.map(g => g.title);
      const gameIds = currentEntry.games.map(g => g.gameId);

      trends.push({
        ngram,
        type: currentEntry.type,
        currentFrequency,
        previousFrequency,
        growthVelocity,
        totalCCU,
        archetype,
        sampleTitles,
        gameIds,
      });
    }

    // Сортировка: сначала с наивысшим CCU, затем с наибольшим ускорением
    trends.sort((a, b) => b.totalCCU - a.totalCCU || b.growthVelocity - a.growthVelocity);

    return trends;
  }

  /**
   * Считывает снимки из директории data/snapshots/ и находит свежие тренды.
   */
  detectTrendsFromDisk(snapshotsDir?: string): ExtractedTrend[] {
    const dir = snapshotsDir || path.resolve(process.cwd(), 'data', 'snapshots');
    if (!fs.existsSync(dir)) return [];

    const files = fs
      .readdirSync(dir)
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) return [];

    const currentRaw = fs.readFileSync(path.join(dir, files[0]), 'utf-8');
    const currentSnapshot = JSON.parse(currentRaw) as MarketSnapshot;

    let previousSnapshot: MarketSnapshot | null = null;
    if (files.length > 1) {
      const prevRaw = fs.readFileSync(path.join(dir, files[1]), 'utf-8');
      previousSnapshot = JSON.parse(prevRaw) as MarketSnapshot;
    }

    return this.extractTrends(currentSnapshot, previousSnapshot);
  }
}
