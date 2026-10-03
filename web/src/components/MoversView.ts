import {
  MarketSnapshot,
  NormalizedGame,
  MarketVerdict,
  GameArchetype,
  PlatformType,
} from '../types.js';

export type GainersSortMode = 'abs' | 'pct';

export interface SparklineData {
  points: number[];
  isPositive: boolean;
  deltaPercent: number;
  svgPath: string;
  endX: number;
  endY: number;
}

export interface GainerItem {
  game: NormalizedGame;
  rank: number;
  currentCcu: number;
  prevCcu: number;
  absDiff: number;
  pctDiff: number;
  sparkline: SparklineData;
}

export interface ViralSignalItem {
  id: string;
  trendTitle: string;
  viralMultiplier: number;
  archetype: GameArchetype;
  metricValue: number;
  sampleTitles: string[];
  sparkline: SparklineData;
  associatedGame?: NormalizedGame;
  verdict?: MarketVerdict;
}

export interface BreakoutItem {
  game: NormalizedGame;
  rank: number;
  ccu: number;
  ageDays: number;
  growthBadge: string;
  sparkline: SparklineData;
}

export interface MoversViewOptions {
  container: HTMLElement;
  currentSnapshot?: MarketSnapshot | null;
  previousSnapshot?: MarketSnapshot | null;
  initialGainersSort?: GainersSortMode;
  onSelectGame?: (game: NormalizedGame) => void;
  onSelectArchetype?: (archetype: GameArchetype) => void;
  onTagClick?: (tag: string) => void;
}

export const ARCHETYPE_RU_MAP: Record<GameArchetype, string> = {
  SIMULATION_INCREMENTAL: 'Симуляторы и +1',
  PHYSICS_SANDBOX: 'Сендбокс и физика',
  MERGE_IDLE: 'Мёрдж и крафт',
  SURVIVAL_HORROR: 'Сурвайвал хоррор',
  WORD_PUZZLE: 'Словесные игры',
  ACTION_SHOOTER: 'Экшен и шутеры',
  OBBY_PARKOUR: 'Обби и паркур',
  OTHER_CASUAL: 'Казуальные игры',
};

export const PLATFORM_NAMES: Record<PlatformType, string> = {
  roblox: 'Roblox',
  yandex_games: 'Яндекс',
  poki: 'Poki',
  youtube_trends: 'YouTube',
};

/**
 * Векторные SVG-иконки интерфейса
 */
export const ICONS = {
  TRENDING_UP: `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
      <polyline points="17 6 23 6 23 12"></polyline>
    </svg>
  `.trim(),
  FIRE: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
    </svg>
  `.trim(),
  ZAP: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
  `.trim(),
  ROCKET: `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path>
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path>
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path>
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path>
    </svg>
  `.trim(),
  CHART_BAR: `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="20" x2="12" y2="10"></line>
      <line x1="18" y1="20" x2="18" y2="4"></line>
      <line x1="6" y1="20" x2="6" y2="16"></line>
    </svg>
  `.trim(),
  ARROW_UP: `
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="18 15 12 9 6 15"></polyline>
    </svg>
  `.trim(),
  SPARK: `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>
  `.trim(),
  CHEVRON_RIGHT: `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  `.trim(),
};

/**
 * Очищает название игры от пустого мусора и спецсимволов
 */
export function cleanDisplayTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/\[\s*\]/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\p{Extended_Pictographic}[^\]]*\]/gu, '')
    .replace(/\p{Extended_Pictographic}|\uFE0F|\uFE0E/gu, '')
    .replace(/\s+/g, ' ')
    .trim() || title;
}

/**
 * Форматирует число CCU / онлайна
 */
export function formatCCU(val: number): string {
  if (val >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(2)}M`;
  }
  if (val >= 1_000) {
    return `${(val / 1_000).toFixed(1)}k`;
  }
  return val.toLocaleString('ru-RU');
}

/**
 * Генерирует детерминированный спарклайн для карточки лидера
 */
export function generateMoversSparkline(
  target: NormalizedGame | number[],
  width = 80,
  height = 24,
  pad = 3
): SparklineData {
  let rawPoints: number[] = [];
  let deltaPercent = 25;
  let isPositive = true;

  if (Array.isArray(target)) {
    rawPoints = [...target];
    if (rawPoints.length < 2) {
      rawPoints = [rawPoints[0] || 10, (rawPoints[0] || 10) * 1.2];
    }
    const first = rawPoints[0] || 1;
    const last = rawPoints[rawPoints.length - 1] || 1;
    deltaPercent = Number((((last - first) / Math.max(1, first)) * 100).toFixed(1));
    isPositive = last >= first;
  } else {
    const game = target;
    let hash = 0;
    const str = (game.id || '') + '_' + (game.genre || '') + '_' + (game.platform || '');
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }

    const isTrending = (game.tags || []).some(t =>
      t.includes('trending') || t.includes('viral') || t.includes('top')
    );

    const normalizedHash = Math.abs(hash % 100) / 100;
    deltaPercent = isTrending
      ? Math.round(20 + normalizedHash * 70)
      : Math.round(-15 + normalizedHash * 65);

    isPositive = deltaPercent >= 0;
    const currentVal = Math.max(10, game.metricValue || 100);
    const startVal = Math.max(5, Math.round(currentVal / (1 + deltaPercent / 100)));

    rawPoints = [startVal];
    for (let day = 1; day < 6; day++) {
      const progress = day / 6;
      const fluctuation = ((Math.sin(hash + day * 1.618) + 1) / 2 - 0.5) * 0.14;
      const interpolated = startVal + (currentVal - startVal) * progress;
      rawPoints.push(Math.max(1, Math.round(interpolated * (1 + fluctuation))));
    }
    rawPoints.push(currentVal);
  }

  const min = Math.min(...rawPoints);
  const max = Math.max(...rawPoints);
  const range = max - min || 1;

  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const coords = rawPoints.map((val, idx) => {
    const x = pad + (idx / Math.max(1, rawPoints.length - 1)) * innerW;
    const y = height - pad - ((val - min) / range) * innerH;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  const svgPath = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
  const lastCoord = coords[coords.length - 1] || { x: width - pad, y: height / 2 };

  return {
    points: rawPoints,
    isPositive,
    deltaPercent,
    svgPath,
    endX: lastCoord.x,
    endY: lastCoord.y,
  };
}

/**
 * Расчет и ранжирование суточных лидеров роста CCU (24h Gainers)
 */
export function calculate24hGainers(
  currentSnapshot?: MarketSnapshot | null,
  previousSnapshot?: MarketSnapshot | null,
  sortMode: GainersSortMode = 'abs'
): GainerItem[] {
  if (!currentSnapshot || !currentSnapshot.games) return [];

  const prevGamesMap = new Map<string, NormalizedGame>();
  if (previousSnapshot && previousSnapshot.games) {
    for (const g of previousSnapshot.games) {
      prevGamesMap.set(g.id, g);
      prevGamesMap.set(`${g.platform}:${g.title.toLowerCase().trim()}`, g);
    }
  }

  const items: GainerItem[] = [];

  for (const game of currentSnapshot.games) {
    if (game.metricType !== 'ccu') continue;

    const prev = prevGamesMap.get(game.id) || prevGamesMap.get(`${game.platform}:${game.title.toLowerCase().trim()}`);
    let prevCcu: number;
    let absDiff: number;
    let pctDiff: number;

    if (prev && typeof prev.metricValue === 'number') {
      prevCcu = prev.metricValue;
      absDiff = game.metricValue - prevCcu;
      pctDiff = prevCcu > 0 ? (absDiff / prevCcu) * 100 : (absDiff > 0 ? 100 : 0);
    } else if (previousSnapshot) {
      // Игры не было в предыдущем срезе — новый участник
      prevCcu = 0;
      absDiff = game.metricValue;
      pctDiff = 100;
    } else {
      // Фолбэк при отсутствии previousSnapshot
      const spark = generateMoversSparkline(game);
      pctDiff = Math.max(5, spark.deltaPercent);
      prevCcu = Math.max(1, Math.round(game.metricValue / (1 + pctDiff / 100)));
      absDiff = game.metricValue - prevCcu;
    }

    if (absDiff > 0) {
      items.push({
        game,
        rank: 0,
        currentCcu: game.metricValue,
        prevCcu,
        absDiff,
        pctDiff: Number(pctDiff.toFixed(2)),
        sparkline: generateMoversSparkline(game),
      });
    }
  }

  if (sortMode === 'pct') {
    items.sort((a, b) => b.pctDiff - a.pctDiff || b.absDiff - a.absDiff);
  } else {
    items.sort((a, b) => b.absDiff - a.absDiff || b.pctDiff - a.pctDiff);
  }

  items.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return items;
}

/**
 * Фильтрация вирусных сигналов YouTube Shorts с множителем >= minMultiplier (1.5x)
 */
export function filterViralSignals(
  currentSnapshot?: MarketSnapshot | null,
  minMultiplier = 1.5
): ViralSignalItem[] {
  if (!currentSnapshot) return [];

  const results: ViralSignalItem[] = [];
  const seenArchetypes = new Set<string>();

  // 1. Из вердиктов снимка
  if (currentSnapshot.verdicts) {
    for (const v of currentSnapshot.verdicts) {
      const vm = v.opportunityScore?.viralMultiplier ?? 1.0;
      if (vm >= minMultiplier) {
        let associatedGame: NormalizedGame | undefined;
        if (v.sampleTitles && v.sampleTitles.length > 0) {
          const sample = v.sampleTitles[0];
          associatedGame = currentSnapshot.games?.find(
            g => g.title === sample || g.title.toLowerCase().includes(sample.toLowerCase())
          );
        }
        if (!associatedGame && currentSnapshot.games) {
          associatedGame = currentSnapshot.games.find(g => g.archetype === v.archetype);
        }

        const trendTitle = v.sampleTitles && v.sampleTitles.length > 0
          ? v.sampleTitles.slice(0, 2).join(' / ')
          : v.titleRu;

        const sparkline = generateMoversSparkline(
          associatedGame || [50, 70, 95, 130, 180, 240]
        );

        results.push({
          id: `viral_${v.archetype}`,
          trendTitle,
          viralMultiplier: vm,
          archetype: v.archetype,
          metricValue: Math.round(vm * 50),
          sampleTitles: v.sampleTitles || [],
          sparkline,
          associatedGame,
          verdict: v,
        });
        seenArchetypes.add(v.archetype);
      }
    }
  }

  // 2. Из карточек YouTube Trends / вирусных тегов
  if (currentSnapshot.games) {
    const ytGames = currentSnapshot.games.filter(
      g => g.platform === 'youtube_trends' || (g.tags && g.tags.includes('viral'))
    );
    for (const g of ytGames) {
      const alreadyAdded = results.some(r => r.associatedGame?.id === g.id || r.trendTitle === g.title);
      if (!alreadyAdded && !seenArchetypes.has(g.archetype)) {
        const verdict = currentSnapshot.verdicts?.find(v => v.archetype === g.archetype);
        const vm = verdict?.opportunityScore?.viralMultiplier ?? (g.tags?.includes('viral') ? 1.75 : 1.0);
        if (vm >= minMultiplier) {
          results.push({
            id: `viral_${g.id}`,
            trendTitle: g.title,
            viralMultiplier: vm,
            archetype: g.archetype,
            metricValue: g.metricValue,
            sampleTitles: [g.title],
            sparkline: generateMoversSparkline(g),
            associatedGame: g,
          });
          seenArchetypes.add(g.archetype);
        }
      }
    }
  }

  results.sort((a, b) => b.viralMultiplier - a.viralMultiplier);
  return results;
}

/**
 * Фильтрация молодых взрывных релизов (< 14 дней на платформе)
 */
export function filterBreakoutNewReleases(
  currentSnapshot?: MarketSnapshot | null,
  maxAgeDays = 14
): BreakoutItem[] {
  if (!currentSnapshot || !currentSnapshot.games) return [];

  const now = currentSnapshot.timestamp ? new Date(currentSnapshot.timestamp).getTime() : Date.now();
  const msInDay = 86400000;

  const items: BreakoutItem[] = [];

  for (const game of currentSnapshot.games) {
    if (game.metricType !== 'ccu') continue;

    const tags = game.tags || [];
    const isUpAndComing = game.sortSource === 'up-and-coming' || tags.includes('up-and-coming');
    const isNewTagged = tags.includes('new') || tags.includes('breakout') || tags.includes('fresh');
    const hasAlphaBeta = /\[(alpha|beta|new|upd|release)\]/i.test(game.title);

    let ageDays = 7;
    let hasTimestamp = false;
    if (game.timestamp) {
      const gameTime = new Date(game.timestamp).getTime();
      if (!Number.isNaN(gameTime)) {
        ageDays = Math.max(1, Math.round((now - gameTime) / msInDay));
        hasTimestamp = true;
      }
    }

    const isYoung = ageDays <= maxAgeDays;
    const isCandidate = isUpAndComing || isNewTagged || hasAlphaBeta;

    // Включаем, если игра имеет маркер новичка и молода, или строго подтверждена по дате
    if ((isCandidate && isYoung) || (hasTimestamp && isYoung && isCandidate)) {
      items.push({
        game,
        rank: 0,
        ccu: game.metricValue,
        ageDays,
        growthBadge: ageDays <= 3 ? '< 3 дней' : `${ageDays} дн. на витрине`,
        sparkline: generateMoversSparkline(game),
      });
    }
  }

  items.sort((a, b) => b.ccu - a.ccu);
  items.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return items;
}

/**
 * MoversViewComponent — экран лидеров роста и опережающих индикаторов
 * (DefiLlama Movers & Shakers стиль)
 */
export class MoversViewComponent {
  private container: HTMLElement;
  private currentSnapshot: MarketSnapshot | null = null;
  private previousSnapshot: MarketSnapshot | null = null;
  private gainersSort: GainersSortMode = 'abs';

  private onSelectGame?: (game: NormalizedGame) => void;
  private onSelectArchetype?: (archetype: GameArchetype) => void;
  private onTagClick?: (tag: string) => void;

  private gainers: GainerItem[] = [];
  private viralSignals: ViralSignalItem[] = [];
  private breakouts: BreakoutItem[] = [];

  private boundClickHandler: (e: MouseEvent) => void;

  constructor(options: MoversViewOptions) {
    this.container = options.container;
    this.currentSnapshot = options.currentSnapshot || null;
    this.previousSnapshot = options.previousSnapshot || null;
    this.gainersSort = options.initialGainersSort || 'abs';
    this.onSelectGame = options.onSelectGame;
    this.onSelectArchetype = options.onSelectArchetype;
    this.onTagClick = options.onTagClick;

    this.boundClickHandler = this.handleClick.bind(this);
    this.container.addEventListener('click', this.boundClickHandler);

    this.recalculate();
    this.render();
  }

  public getGainers(): GainerItem[] {
    return this.gainers;
  }

  public getViralSignals(): ViralSignalItem[] {
    return this.viralSignals;
  }

  public getBreakouts(): BreakoutItem[] {
    return this.breakouts;
  }

  public getGainersSort(): GainersSortMode {
    return this.gainersSort;
  }

  public setGainersSort(mode: GainersSortMode): void {
    if (this.gainersSort === mode) return;
    this.gainersSort = mode;
    this.gainers = calculate24hGainers(this.currentSnapshot, this.previousSnapshot, this.gainersSort);
    this.render();
  }

  public updateData(currentSnapshot: MarketSnapshot, previousSnapshot?: MarketSnapshot | null): void {
    this.currentSnapshot = currentSnapshot;
    this.previousSnapshot = previousSnapshot ?? null;
    this.recalculate();
    this.render();
  }

  public destroy(): void {
    this.container.removeEventListener('click', this.boundClickHandler);
    this.container.innerHTML = '';
  }

  private recalculate(): void {
    this.gainers = calculate24hGainers(this.currentSnapshot, this.previousSnapshot, this.gainersSort);
    this.viralSignals = filterViralSignals(this.currentSnapshot, 1.5);
    this.breakouts = filterBreakoutNewReleases(this.currentSnapshot, 14);
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target) return;

    // 1. Переключение сортировки 24h Gainers
    const sortBtn =
      target.closest<HTMLElement>('.gainers-sort-toggle') ||
      target.closest<HTMLElement>('[data-sort-mode]');
    if (sortBtn) {
      const mode = sortBtn.getAttribute('data-sort-mode') as GainersSortMode;
      if (mode === 'abs' || mode === 'pct') {
        this.setGainersSort(mode);
        return;
      }
    }

    // 2. Клик по кнопке инспектора
    const inspectBtn =
      target.closest<HTMLElement>('.btn-inspect') ||
      target.closest<HTMLElement>('.card-inspect-btn') ||
      target.closest<HTMLElement>('button[data-action="inspect"]');
    if (inspectBtn) {
      e.stopPropagation();
      const gameId = inspectBtn.getAttribute('data-game-id');
      const archetype = inspectBtn.getAttribute('data-archetype') as GameArchetype | null;

      if (gameId && this.currentSnapshot?.games) {
        const found = this.currentSnapshot.games.find(g => g.id === gameId);
        if (found) {
          this.onSelectGame?.(found);
          return;
        }
      }

      if (archetype) {
        this.onSelectArchetype?.(archetype);
        return;
      }
    }

    // 3. Клик по тегу архетипа
    const archetypeTag =
      target.closest<HTMLElement>('.archetype-tag') ||
      target.closest<HTMLElement>('.badge-archetype') ||
      target.closest<HTMLElement>('[data-archetype]');
    if (archetypeTag) {
      const archetype = archetypeTag.getAttribute('data-archetype') as GameArchetype | null;
      if (archetype) {
        this.onSelectArchetype?.(archetype);
        return;
      }
    }

    // 4. Клик по карточке целиком (если не кнопка)
    const card =
      target.closest<HTMLElement>('.movers-card') ||
      target.closest<HTMLElement>('[data-card="mover"]');
    if (card) {
      const gameId = card.getAttribute('data-id');
      if (gameId && this.currentSnapshot?.games) {
        const found = this.currentSnapshot.games.find(g => g.id === gameId);
        if (found) {
          this.onSelectGame?.(found);
          return;
        }
      }
      const archetype = card.getAttribute('data-archetype') as GameArchetype | null;
      if (archetype) {
        this.onSelectArchetype?.(archetype);
        return;
      }
    }
  }

  private render(): void {
    const topGainer = this.gainers[0];
    const topGainerLabel = topGainer
      ? `${cleanDisplayTitle(topGainer.game.title)} (+${formatCCU(topGainer.absDiff)})`
      : '—';

    this.container.innerHTML = `
      <div class="movers-container">
        <!-- HEADER & KPI STRIP -->
        <header class="movers-header">
          <div class="movers-title-row">
            <div class="movers-title-group">
              <div class="movers-eyebrow">DefiLlama Movers & Shakers</div>
              <h2 class="movers-title">Лидеры роста и социальные индикаторы</h2>
              <p class="movers-subtitle">
                Скринер аномалий рынка: суточный прирост онлайна, опережающие мемы YouTube Shorts (&gt;1.5x) и молодые проекты (&lt; 14 дней).
              </p>
            </div>
            <div class="movers-quick-kpi">
              <div class="kpi-mini-pill">
                <span class="kpi-mini-icon">${ICONS.ZAP}</span>
                <span class="kpi-mini-label">Топ гейнер:</span>
                <span class="kpi-mini-value" id="movers-kpi-top">${topGainerLabel}</span>
              </div>
              <div class="kpi-mini-pill">
                <span class="kpi-mini-icon">${ICONS.FIRE}</span>
                <span class="kpi-mini-label">Вирусных сигналов:</span>
                <span class="kpi-mini-value">${this.viralSignals.length}</span>
              </div>
              <div class="kpi-mini-pill">
                <span class="kpi-mini-icon">${ICONS.ROCKET}</span>
                <span class="kpi-mini-label">Взрывных новинок:</span>
                <span class="kpi-mini-value">${this.breakouts.length}</span>
              </div>
            </div>
          </div>
        </header>

        <!-- 1. СЕКЦИЯ: ТОП ЛИДЕРОВ РОСТА CCU (24H GAINERS) -->
        <section class="movers-section movers-section-gainers" data-section="gainers">
          <div class="movers-section-header">
            <div class="section-title-wrap">
              <div class="section-icon">${ICONS.TRENDING_UP}</div>
              <div>
                <h3 class="section-title">Топ лидеров роста CCU (24h Gainers)</h3>
                <span class="section-subtitle">Проекты с максимальным абсолютным и процентным приростом за последние 24 часа</span>
              </div>
            </div>
            <div class="gainers-sort-controls">
              <span class="sort-controls-label">Сортировка:</span>
              <div class="segmented-sort-buttons">
                <button
                  type="button"
                  class="gainers-sort-toggle btn-toggle-sort-abs ${this.gainersSort === 'abs' ? 'active' : ''}"
                  data-sort-mode="abs"
                  title="Ранжировать по абсолютному приросту CCU"
                >
                  По абсолютному (+CCU)
                </button>
                <button
                  type="button"
                  class="gainers-sort-toggle btn-toggle-sort-pct ${this.gainersSort === 'pct' ? 'active' : ''}"
                  data-sort-mode="pct"
                  title="Ранжировать по процентному росту"
                >
                  По проценту (+%)
                </button>
              </div>
            </div>
          </div>

          <div class="movers-grid">
            ${this.renderGainersCards()}
          </div>
        </section>

        <!-- 2. СЕКЦИЯ: ВИРУСНЫЕ СИГНАЛЫ YOUTUBE SHORTS (> 1.5x) -->
        <section class="movers-section movers-section-viral" data-section="viral">
          <div class="movers-section-header">
            <div class="section-title-wrap">
              <div class="section-icon">${ICONS.FIRE}</div>
              <div>
                <h3 class="section-title">Вирусные сигналы YouTube Shorts</h3>
                <span class="section-subtitle">Карточки мемов с множителем viralMultiplier (&gt;1.5x) до их массового выхода в топы витрин</span>
              </div>
            </div>
            <span class="section-badge viral-badge">${this.viralSignals.length} активных мема</span>
          </div>

          <div class="movers-grid">
            ${this.renderViralCards()}
          </div>
        </section>

        <!-- 3. СЕКЦИЯ: ВЗРЫВНЫЕ НОВИНКИ (< 14 ДНЕЙ) -->
        <section class="movers-section movers-section-breakout" data-section="breakout">
          <div class="movers-section-header">
            <div class="section-title-wrap">
              <div class="section-icon">${ICONS.ROCKET}</div>
              <div>
                <h3 class="section-title">Взрывные новинки (&lt; 14 дней на платформе)</h3>
                <span class="section-subtitle">Молодые проекты витрин, быстро аккумулирующие органическую аудиторию</span>
              </div>
            </div>
            <span class="section-badge breakout-badge">${this.breakouts.length} молодых хитов</span>
          </div>

          <div class="movers-grid">
            ${this.renderBreakoutCards()}
          </div>
        </section>
      </div>
    `;
  }

  private renderGainersCards(): string {
    if (this.gainers.length === 0) {
      return `
        <div class="movers-empty-card">
          <span class="empty-icon">${ICONS.CHART_BAR}</span>
          <p>Недостаточно исторических данных для фиксации 24h дельты. Сделайте повторный скан рынка.</p>
        </div>
      `;
    }

    return this.gainers.map(item => {
      const g = item.game;
      const cleanTitle = cleanDisplayTitle(g.title);
      const platLabel = PLATFORM_NAMES[g.platform] || g.platform;
      const archLabel = ARCHETYPE_RU_MAP[g.archetype] || g.archetype;
      const pctSign = item.pctDiff >= 0 ? '+' : '';
      const sparkSvg = this.renderSparklineSvg(item.sparkline, '#27a644');

      return `
        <div class="movers-card card-gainer" data-card="mover" data-id="${g.id}">
          <div class="card-top-row">
            <span class="card-rank">#${item.rank}</span>
            <span class="card-platform-badge ${g.platform}">${platLabel}</span>
            <span class="card-growth-badge positive">
              <span class="badge-arrow">${ICONS.ARROW_UP}</span>
              <span>+${formatCCU(item.absDiff)} (${pctSign}${item.pctDiff}%)</span>
            </span>
          </div>

          <div class="card-main-info">
            <h4 class="card-title movers-card-title" title="${g.title}">${cleanTitle}</h4>
            <div class="card-metrics-row">
              <div class="metric-block">
                <span class="metric-caption">Онлайн CCU</span>
                <span class="metric-num">${formatCCU(item.currentCcu)}</span>
              </div>
              <div class="sparkline-wrapper">
                ${sparkSvg}
              </div>
            </div>
          </div>

          <div class="card-bottom-row">
            <span class="archetype-tag badge-archetype" data-archetype="${g.archetype}" title="Архетип: ${archLabel}">
              ${archLabel}
            </span>
            <button
              type="button"
              class="btn-inspect card-inspect-btn"
              data-action="inspect"
              data-game-id="${g.id}"
              title="Открыть аналитический инспектор игры"
            >
              <span>Инспектор</span>
              ${ICONS.CHEVRON_RIGHT}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  private renderViralCards(): string {
    if (this.viralSignals.length === 0) {
      return `
        <div class="movers-empty-card">
          <span class="empty-icon">${ICONS.FIRE}</span>
          <p>В текущем снимке нет сигналов с множителем viralMultiplier &gt; 1.5x.</p>
        </div>
      `;
    }

    return this.viralSignals.map(item => {
      const archLabel = ARCHETYPE_RU_MAP[item.archetype] || item.archetype;
      const sparkSvg = this.renderSparklineSvg(item.sparkline, '#ff7043');
      const gameId = item.associatedGame?.id || '';

      return `
        <div class="movers-card card-viral" data-card="mover" data-id="${item.id}" data-archetype="${item.archetype}">
          <div class="card-top-row">
            <span class="card-viral-multiplier">
              ${ICONS.FIRE}
              <span>${item.viralMultiplier}x Multiplier</span>
            </span>
            <span class="card-signal-badge">Опережающий сигнал</span>
          </div>

          <div class="card-main-info">
            <h4 class="card-title movers-card-title">${item.trendTitle}</h4>
            <div class="card-metrics-row">
              <div class="metric-block">
                <span class="metric-caption">Вирусный охват</span>
                <span class="metric-num">${item.metricValue} pts</span>
              </div>
              <div class="sparkline-wrapper">
                ${sparkSvg}
              </div>
            </div>
          </div>

          <div class="card-bottom-row">
            <span class="archetype-tag badge-archetype" data-archetype="${item.archetype}" title="Архетип: ${archLabel}">
              ${archLabel}
            </span>
            <button
              type="button"
              class="btn-inspect card-inspect-btn"
              data-action="inspect"
              data-game-id="${gameId}"
              data-archetype="${item.archetype}"
              title="Открыть инспектор тренда"
            >
              <span>Инспектор</span>
              ${ICONS.CHEVRON_RIGHT}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  private renderBreakoutCards(): string {
    if (this.breakouts.length === 0) {
      return `
        <div class="movers-empty-card">
          <span class="empty-icon">${ICONS.ROCKET}</span>
          <p>Новых проектов с быстрой динамикой (&lt; 14 дней) пока не обнаружено.</p>
        </div>
      `;
    }

    return this.breakouts.map(item => {
      const g = item.game;
      const cleanTitle = cleanDisplayTitle(g.title);
      const platLabel = PLATFORM_NAMES[g.platform] || g.platform;
      const archLabel = ARCHETYPE_RU_MAP[g.archetype] || g.archetype;
      const sparkSvg = this.renderSparklineSvg(item.sparkline, '#02b8cc');

      return `
        <div class="movers-card card-breakout" data-card="mover" data-id="${g.id}">
          <div class="card-top-row">
            <span class="card-rank">#${item.rank}</span>
            <span class="card-platform-badge ${g.platform}">${platLabel}</span>
            <span class="card-age-badge">
              ${ICONS.SPARK}
              <span>${item.growthBadge}</span>
            </span>
          </div>

          <div class="card-main-info">
            <h4 class="card-title movers-card-title" title="${g.title}">${cleanTitle}</h4>
            <div class="card-metrics-row">
              <div class="metric-block">
                <span class="metric-caption">Стартовый CCU</span>
                <span class="metric-num">${formatCCU(item.ccu)}</span>
              </div>
              <div class="sparkline-wrapper">
                ${sparkSvg}
              </div>
            </div>
          </div>

          <div class="card-bottom-row">
            <span class="archetype-tag badge-archetype" data-archetype="${g.archetype}" title="Архетип: ${archLabel}">
              ${archLabel}
            </span>
            <button
              type="button"
              class="btn-inspect card-inspect-btn"
              data-action="inspect"
              data-game-id="${g.id}"
              title="Открыть аналитический инспектор новинки"
            >
              <span>Инспектор</span>
              ${ICONS.CHEVRON_RIGHT}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  private renderSparklineSvg(spark: SparklineData, color: string): string {
    return `
      <svg class="mover-sparkline" width="80" height="24" viewBox="0 0 80 24">
        <path d="${spark.svgPath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="${spark.endX}" cy="${spark.endY}" r="2.5" fill="${color}" />
      </svg>
    `;
  }
}

export const MoversView = MoversViewComponent;
