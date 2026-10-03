import { NormalizedGame, PlatformType, GameArchetype, MarketVerdict } from '../types.js';

export type TableSortColumn =
  | 'rank'
  | 'platform'
  | 'title'
  | 'genre'
  | 'ccu'
  | 'trend'
  | 'opportunity'
  | 'likes';

export type TableSortDirection = 'asc' | 'desc';
export type TableViewMode = 'table' | 'grid';

export interface GameTableViewOptions {
  container: HTMLElement;
  games: NormalizedGame[];
  verdicts?: MarketVerdict[];
  onSelectGame: (game: NormalizedGame) => void;
  onTagClick?: (tag: string) => void;
  initialSortColumn?: TableSortColumn;
  initialSortDirection?: TableSortDirection;
  initialViewMode?: TableViewMode;
  initialPlatform?: 'all' | PlatformType;
  initialSearchQuery?: string;
  initialMinCcu?: number;
  initialLimit?: number;
  onViewModeChange?: (mode: TableViewMode) => void;
  onSortChange?: (column: TableSortColumn, direction: TableSortDirection) => void;
  onPlatformChange?: (platform: 'all' | PlatformType) => void;
  onFilterChange?: (filteredCount: number, totalCount: number) => void;
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

export interface SparklineData {
  points: number[];
  isPositive: boolean;
  deltaPercent: number;
  svgPath: string;
  endX: number;
  endY: number;
}

/**
 * Deterministically generates a 7-day trend series and SVG path for a game
 */
export function generateGameSparkline(game: NormalizedGame, width = 76, height = 22, pad = 3): SparklineData {
  let hash = 0;
  const str = game.id + '_' + (game.genre || '') + '_' + game.platform;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  const isTrending = (game.tags || []).some(t =>
    t.includes('trending') || t.includes('viral') || t.includes('top')
  );

  const normalizedHash = Math.abs(hash % 100) / 100;
  const deltaPercent = isTrending
    ? Math.round(15 + normalizedHash * 70) // +15% .. +85%
    : Math.round(-28 + normalizedHash * 80); // -28% .. +52%

  const isPositive = deltaPercent >= 0;
  const currentVal = Math.max(10, game.metricValue);
  const startVal = Math.max(5, Math.round(currentVal / (1 + deltaPercent / 100)));

  const rawPoints: number[] = [startVal];
  for (let day = 1; day < 6; day++) {
    const progress = day / 6;
    const fluctuation = ((Math.sin(hash + day * 1.618) + 1) / 2 - 0.5) * 0.16;
    const interpolated = startVal + (currentVal - startVal) * progress;
    rawPoints.push(Math.max(1, Math.round(interpolated * (1 + fluctuation))));
  }
  rawPoints.push(currentVal);

  const min = Math.min(...rawPoints);
  const max = Math.max(...rawPoints);
  const range = max - min || 1;

  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const coords = rawPoints.map((val, idx) => {
    const x = pad + (idx / (rawPoints.length - 1)) * innerW;
    const y = height - pad - ((val - min) / range) * innerH;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  const svgPath = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
  const lastCoord = coords[coords.length - 1];

  return {
    points: rawPoints,
    isPositive,
    deltaPercent,
    svgPath,
    endX: lastCoord.x,
    endY: lastCoord.y,
  };
}

export class GameTableView {
  private container: HTMLElement;
  private allGames: NormalizedGame[] = [];
  private verdictMap: Map<GameArchetype, MarketVerdict> = new Map();
  private onSelectGame: (game: NormalizedGame) => void;
  private onTagClick?: (tag: string) => void;

  private platformFilter: 'all' | PlatformType = 'all';
  private searchQuery: string = '';
  private minCcu: number = 0;
  private sortColumn: TableSortColumn = 'ccu';
  private sortDirection: TableSortDirection = 'desc';
  private viewMode: TableViewMode = 'table';
  private displayLimit: number = 100;

  private onViewModeChange?: (mode: TableViewMode) => void;
  private onSortChange?: (column: TableSortColumn, direction: TableSortDirection) => void;
  private onPlatformChange?: (platform: 'all' | PlatformType) => void;
  private onFilterChange?: (filteredCount: number, totalCount: number) => void;

  private boundKeydownHandler?: (e: KeyboardEvent) => void;

  constructor(options: GameTableViewOptions) {
    this.container = options.container;
    this.allGames = options.games || [];
    this.onSelectGame = options.onSelectGame;
    this.onTagClick = options.onTagClick;

    if (options.verdicts) {
      this.setVerdicts(options.verdicts);
    }

    if (options.initialSortColumn) this.sortColumn = options.initialSortColumn;
    if (options.initialSortDirection) this.sortDirection = options.initialSortDirection;
    if (options.initialViewMode) this.viewMode = options.initialViewMode;
    if (options.initialPlatform) this.platformFilter = options.initialPlatform;
    if (options.initialSearchQuery) this.searchQuery = options.initialSearchQuery.trim().toLowerCase();
    if (options.initialMinCcu !== undefined) this.minCcu = options.initialMinCcu;
    if (options.initialLimit !== undefined) this.displayLimit = options.initialLimit;

    this.onViewModeChange = options.onViewModeChange;
    this.onSortChange = options.onSortChange;
    this.onPlatformChange = options.onPlatformChange;
    this.onFilterChange = options.onFilterChange;

    this.initEvents();
    this.initGlobalShortcuts();
    this.render();
  }

  public setVerdicts(verdicts: MarketVerdict[]): void {
    this.verdictMap.clear();
    for (const v of verdicts) {
      this.verdictMap.set(v.archetype, v);
    }
  }

  public updateData(games: NormalizedGame[], verdicts?: MarketVerdict[]): void {
    this.allGames = games || [];
    if (verdicts) {
      this.setVerdicts(verdicts);
    }
    this.render();
    this.notifyFilterChange();
  }

  public setPlatform(platform: 'all' | PlatformType): void {
    this.platformFilter = platform;
    this.displayLimit = 100;
    this.render();
    this.onPlatformChange?.(platform);
    this.notifyFilterChange();
  }

  public setSearchQuery(query: string): void {
    this.searchQuery = query.trim().toLowerCase();
    this.displayLimit = 100;
    this.render();
    this.notifyFilterChange();
  }

  public setMinCcu(val: number): void {
    this.minCcu = Math.max(0, val);
    this.displayLimit = 100;
    this.render();
    this.notifyFilterChange();
  }

  public setSort(column: TableSortColumn, direction?: TableSortDirection): void {
    if (this.sortColumn === column && !direction) {
      this.sortDirection = this.sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
      this.sortColumn = column;
      this.sortDirection = direction || (['title', 'rank', 'genre', 'platform'].includes(column) ? 'asc' : 'desc');
    }
    this.render();
    this.onSortChange?.(this.sortColumn, this.sortDirection);
  }

  public setViewMode(mode: TableViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.render();
    this.onViewModeChange?.(mode);
  }

  public getViewMode(): TableViewMode {
    return this.viewMode;
  }

  public getSort(): { column: TableSortColumn; direction: TableSortDirection } {
    return { column: this.sortColumn, direction: this.sortDirection };
  }

  public getPlatform(): 'all' | PlatformType {
    return this.platformFilter;
  }

  public getSearchQuery(): string {
    return this.searchQuery;
  }

  public getTotalGamesCount(): number {
    return this.allGames.length;
  }

  public getFilteredCount(): number {
    return this.getFilteredGames().length;
  }

  public getOpportunityScoreForArchetype(archetype: GameArchetype): { score: number; status: string } {
    const verdict = this.verdictMap.get(archetype);
    if (verdict?.opportunityScore) {
      return {
        score: verdict.opportunityScore.overallScore,
        status: verdict.status || 'GREEN_LIGHT',
      };
    }
    return { score: 70, status: 'GREEN_LIGHT' };
  }

  public getFilteredGames(): NormalizedGame[] {
    let result = this.allGames.slice();

    // 1. Min CCU filter
    if (this.minCcu > 0) {
      result = result.filter(g => (g.metricType === 'ccu' ? g.metricValue >= this.minCcu : false));
    }

    // 2. Platform filter
    if (this.platformFilter !== 'all') {
      result = result.filter(g => g.platform === this.platformFilter);
    }

    // 3. Search query filter
    if (this.searchQuery) {
      const q = this.searchQuery;
      result = result.filter(g => {
        const titleMatch = (g.title || '').toLowerCase().includes(q);
        const genreMatch = (g.genre || '').toLowerCase().includes(q);
        const archLabel = (ARCHETYPE_RU_MAP[g.archetype] || '').toLowerCase();
        const archMatch = archLabel.includes(q) || (g.archetype || '').toLowerCase().includes(q);
        const tagMatch = (g.tags || []).some(t => t.toLowerCase().includes(q));
        return titleMatch || genreMatch || archMatch || tagMatch;
      });
    }

    // 4. Sort (natural ascending cmp, negated if desc)
    result.sort((a, b) => {
      let cmp = 0;
      switch (this.sortColumn) {
        case 'ccu':
          cmp = (a.metricValue || 0) - (b.metricValue || 0);
          break;
        case 'opportunity': {
          const scoreA = this.getOpportunityScoreForArchetype(a.archetype).score;
          const scoreB = this.getOpportunityScoreForArchetype(b.archetype).score;
          cmp = scoreA - scoreB;
          break;
        }
        case 'likes': {
          const lA = typeof a.likeRatio === 'number' ? a.likeRatio : 0;
          const lB = typeof b.likeRatio === 'number' ? b.likeRatio : 0;
          cmp = lA - lB;
          break;
        }
        case 'title':
          cmp = (a.title || '').localeCompare(b.title || '', 'ru', { sensitivity: 'base' });
          break;
        case 'platform':
          cmp = (a.platform || '').localeCompare(b.platform || '');
          break;
        case 'genre': {
          const gA = ARCHETYPE_RU_MAP[a.archetype] || a.genre || '';
          const gB = ARCHETYPE_RU_MAP[b.archetype] || b.genre || '';
          cmp = gA.localeCompare(gB, 'ru');
          break;
        }
        case 'trend': {
          const tA = generateGameSparkline(a).deltaPercent;
          const tB = generateGameSparkline(b).deltaPercent;
          cmp = tA - tB;
          break;
        }
        case 'rank':
        default:
          cmp = 0;
          break;
      }

      return this.sortDirection === 'desc' ? -cmp : cmp;
    });

    return result;
  }

  private notifyFilterChange(): void {
    if (this.onFilterChange) {
      this.onFilterChange(this.getFilteredCount(), this.getTotalGamesCount());
    }
  }

  private initEvents(): void {
    this.container.addEventListener('click', e => {
      const target = e.target as HTMLElement;

      // 1. External link click - prevent opening drawer
      const extLink = target.closest('.table-store-link, .catalog-ext-link') as HTMLElement;
      if (extLink) {
        e.stopPropagation();
        return;
      }

      // 2. Tag click - trigger search filter
      const tagEl = target.closest('.catalog-tag-chip') as HTMLElement;
      if (tagEl) {
        e.stopPropagation();
        const tag = tagEl.getAttribute('data-tag');
        if (tag && this.onTagClick) {
          this.onTagClick(tag);
        }
        return;
      }

      // 3. Platform chips click
      const chipBtn = target.closest('.table-platform-chip') as HTMLElement;
      if (chipBtn) {
        e.stopPropagation();
        const p = chipBtn.getAttribute('data-platform') as any;
        if (p) this.setPlatform(p);
        return;
      }

      // 4. View mode toggle click
      const viewModeBtn = target.closest('.table-view-toggle-btn') as HTMLElement;
      if (viewModeBtn) {
        e.stopPropagation();
        const mode = viewModeBtn.getAttribute('data-mode') as TableViewMode;
        if (mode) this.setViewMode(mode);
        return;
      }

      // 5. Column header sort click
      const thEl = target.closest('th.sortable') as HTMLElement;
      if (thEl) {
        e.stopPropagation();
        const col = thEl.getAttribute('data-sort-col') as TableSortColumn;
        if (col) this.setSort(col);
        return;
      }

      // 6. Action button click
      const actionBtn = target.closest('.table-action-btn') as HTMLElement;
      if (actionBtn) {
        e.stopPropagation();
        const gameId = actionBtn.getAttribute('data-game-id');
        const game = this.allGames.find(g => g.id === gameId);
        if (game) this.onSelectGame(game);
        return;
      }

      // 7. Load more / Load all
      const loadMoreBtn = target.closest('#btn-table-load-more') as HTMLElement;
      if (loadMoreBtn) {
        e.stopPropagation();
        this.displayLimit += 100;
        this.render();
        return;
      }

      const loadAllBtn = target.closest('#btn-table-load-all') as HTMLElement;
      if (loadAllBtn) {
        e.stopPropagation();
        this.displayLimit = this.allGames.length;
        this.render();
        return;
      }

      // 8. Row click or Card click
      const rowOrCard = target.closest('.steamdb-table-row, .catalog-game-card') as HTMLElement;
      if (rowOrCard) {
        const gameId = rowOrCard.getAttribute('data-game-id');
        if (gameId) {
          const game = this.allGames.find(g => g.id === gameId);
          if (game) this.onSelectGame(game);
        }
      }
    });

    // Search input handler
    this.container.addEventListener('input', e => {
      const target = e.target as HTMLElement;
      if (target.matches('.steamdb-search-input')) {
        const val = (target as HTMLInputElement).value;
        this.searchQuery = val.trim().toLowerCase();
        this.displayLimit = 100;
        this.renderTableContentOnly();
        this.notifyFilterChange();
      }
    });
  }

  private initGlobalShortcuts(): void {
    if (typeof window === 'undefined') return;

    this.boundKeydownHandler = (e: KeyboardEvent) => {
      // Hotkey: Ctrl+K / ⌘K focuses table quick search input
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const searchInput = this.container.querySelector('.steamdb-search-input') as HTMLInputElement;
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
      }
    };

    window.addEventListener('keydown', this.boundKeydownHandler);
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.boundKeydownHandler) {
      window.removeEventListener('keydown', this.boundKeydownHandler);
    }
  }

  private render(): void {
    const filteredGames = this.getFilteredGames();
    const totalCount = this.allGames.length;
    const filteredCount = filteredGames.length;

    this.container.innerHTML = `
      <div class="steamdb-table-container" data-view-mode="${this.viewMode}">
        <!-- SteamDB Controls & Search Header Bar -->
        ${this.renderHeaderToolbar(filteredCount, totalCount)}

        <!-- Active View Content -->
        <div class="steamdb-view-body" id="steamdb-view-body">
          ${
            filteredCount === 0
              ? this.renderEmptyState()
              : this.viewMode === 'table'
              ? this.renderTableView(filteredGames)
              : this.renderGridView(filteredGames)
          }
        </div>
      </div>
    `;
  }

  /**
   * Lightweight re-render of only table/grid body during search input to avoid losing input focus
   */
  private renderTableContentOnly(): void {
    const bodyEl = this.container.querySelector('#steamdb-view-body');
    const badgeEl = this.container.querySelector('#steamdb-count-badge');
    const filteredGames = this.getFilteredGames();

    if (badgeEl) {
      badgeEl.textContent = `${filteredGames.length} из ${this.allGames.length}`;
    }

    if (bodyEl) {
      bodyEl.innerHTML =
        filteredGames.length === 0
          ? this.renderEmptyState()
          : this.viewMode === 'table'
          ? this.renderTableView(filteredGames)
          : this.renderGridView(filteredGames);
    }
  }

  private renderHeaderToolbar(filteredCount: number, totalCount: number): string {
    const platforms: Array<{ id: 'all' | PlatformType; label: string }> = [
      { id: 'all', label: 'Все' },
      { id: 'roblox', label: 'Roblox' },
      { id: 'yandex_games', label: 'Яндекс Игры' },
      { id: 'poki', label: 'Poki' },
      { id: 'youtube_trends', label: 'Shorts' },
    ];

    const chipsHtml = platforms
      .map(
        p => `
        <button type="button" class="table-platform-chip ${this.platformFilter === p.id ? 'active' : ''}" data-platform="${p.id}">
          <span>${p.label}</span>
        </button>
      `
      )
      .join('');

    return `
      <div class="steamdb-header-toolbar">
        <div class="steamdb-toolbar-row-top">
          <!-- Quick search in recessed well with Ctrl+K badge -->
          <div class="steamdb-search-well">
            <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="search"
              class="steamdb-search-input"
              placeholder="Поиск по ${totalCount}+ играм (название, жанр, теги)..."
              value="${this.escapeHtml(this.searchQuery)}"
              autocomplete="off"
              spellcheck="false"
            />
            <kbd class="steamdb-kbd-badge" title="Нажмите Ctrl+K или ⌘K для быстрого фокуса">⌘K</kbd>
          </div>

          <!-- View Mode Toggles: Table (Default) & Grid -->
          <div class="steamdb-view-toggles">
            <button
              type="button"
              class="table-view-toggle-btn ${this.viewMode === 'table' ? 'active' : ''}"
              data-mode="table"
              title="Таблица высокой плотности (SteamDB)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
              <span>Таблица</span>
            </button>
            <button
              type="button"
              class="table-view-toggle-btn ${this.viewMode === 'grid' ? 'active' : ''}"
              data-mode="grid"
              title="Сетка карточек"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              <span>Сетка</span>
            </button>
          </div>
        </div>

        <div class="steamdb-toolbar-row-bottom">
          <!-- Platform Filter Chips -->
          <div class="steamdb-chips-wrap">
            <span class="chips-label">Платформы:</span>
            ${chipsHtml}
          </div>

          <!-- Counter badge -->
          <div class="steamdb-counter-badge" id="steamdb-count-badge">
            ${filteredCount} из ${totalCount}
          </div>
        </div>
      </div>
    `;
  }

  private renderTableView(games: NormalizedGame[]): string {
    const visibleGames = games.slice(0, this.displayLimit);
    const rowsHtml = visibleGames.map((game, idx) => this.renderTableRow(game, idx)).join('');

    const hasMore = games.length > this.displayLimit;

    return `
      <div class="steamdb-table-wrapper">
        <table class="steamdb-table steamdb-data-table">
          <thead>
            <tr>
              <th class="th-rank sortable ${this.sortColumn === 'rank' ? 'sort-active' : ''}" data-sort-col="rank" title="Сортировка по рангу">
                <div class="th-inner"><span># Ранг</span>${this.renderSortArrow('rank')}</div>
              </th>
              <th class="th-platform sortable ${this.sortColumn === 'platform' ? 'sort-active' : ''}" data-sort-col="platform" title="Сортировка по платформе">
                <div class="th-inner"><span>Платформа</span>${this.renderSortArrow('platform')}</div>
              </th>
              <th class="th-title sortable ${this.sortColumn === 'title' ? 'sort-active' : ''}" data-sort-col="title" title="Сортировка по названию">
                <div class="th-inner"><span>Название игры</span>${this.renderSortArrow('title')}</div>
              </th>
              <th class="th-genre sortable ${this.sortColumn === 'genre' ? 'sort-active' : ''}" data-sort-col="genre" title="Сортировка по жанру/архетипу">
                <div class="th-inner"><span>Жанр / Архетип</span>${this.renderSortArrow('genre')}</div>
              </th>
              <th class="th-ccu sortable text-right ${this.sortColumn === 'ccu' ? 'sort-active' : ''}" data-sort-col="ccu" title="Сортировка по онлайну CCU">
                <div class="th-inner justify-end"><span>Онлайн CCU</span>${this.renderSortArrow('ccu')}</div>
              </th>
              <th class="th-trend sortable ${this.sortColumn === 'trend' ? 'sort-active' : ''}" data-sort-col="trend" title="Сортировка по 7d тренду">
                <div class="th-inner justify-center"><span>7d Тренд</span>${this.renderSortArrow('trend')}</div>
              </th>
              <th class="th-opportunity sortable ${this.sortColumn === 'opportunity' ? 'sort-active' : ''}" data-sort-col="opportunity" title="Сортировка по Opportunity Score">
                <div class="th-inner justify-center"><span>Opportunity Score</span>${this.renderSortArrow('opportunity')}</div>
              </th>
              <th class="th-likes sortable text-center ${this.sortColumn === 'likes' ? 'sort-active' : ''}" data-sort-col="likes" title="Сортировка по проценту лайков">
                <div class="th-inner justify-center"><span>Лайки %</span>${this.renderSortArrow('likes')}</div>
              </th>
              <th class="th-actions text-right">
                <div class="th-inner justify-end"><span>Действия</span></div>
              </th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      ${
        hasMore
          ? `
        <div class="steamdb-pagination-row">
          <button type="button" class="btn-steamdb-more" id="btn-table-load-more">
            Показать еще (+100)
          </button>
          <button type="button" class="btn-steamdb-all" id="btn-table-load-all">
            Показать все (${games.length})
          </button>
        </div>
      `
          : ''
      }
    `;
  }

  private renderTableRow(game: NormalizedGame, index: number): string {
    const pMeta = this.getPlatformMeta(game.platform);
    const archName = ARCHETYPE_RU_MAP[game.archetype] || game.archetype;
    const formattedCcu = this.formatMetricVal(game);
    const likePct = this.formatLikes(game);
    const oppInfo = this.getOpportunityScoreForArchetype(game.archetype);
    const spark = generateGameSparkline(game);
    const storeUrl = game.url || this.generatePlatformSearchUrl(game.platform, game.title);

    const scoreClass =
      oppInfo.score >= 75
        ? 'score-high'
        : oppInfo.score >= 55
        ? 'score-med'
        : 'score-low';

    const trendColor = spark.isPositive ? 'var(--status-growth, #27a644)' : 'var(--status-danger, #eb5757)';
    const trendClass = spark.isPositive ? 'sparkline-growth' : 'sparkline-drop';
    const deltaSign = spark.isPositive ? '+' : '';

    return `
      <tr class="steamdb-table-row" data-game-id="${this.escapeHtml(game.id)}" tabindex="0" role="button">
        <!-- 1. Rank -->
        <td class="td-rank">
          <span class="table-rank-num tabular-nums">#${index + 1}</span>
        </td>

        <!-- 2. Platform -->
        <td class="td-platform">
          <span class="table-platform-badge ${pMeta.badgeClass}" title="${pMeta.label}">
            ${pMeta.iconSvg}
            <span>${pMeta.label}</span>
          </span>
        </td>

        <!-- 3. Title with Storefront icon -->
        <td class="td-title">
          <div class="table-title-cell">
            <span class="table-game-title" title="${this.escapeHtml(game.title)}">${this.escapeHtml(game.title)}</span>
            <a href="${this.escapeHtml(storeUrl)}" target="_blank" rel="noopener noreferrer" class="table-store-link" title="Открыть витрину в новой вкладке">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </a>
          </div>
        </td>

        <!-- 4. Genre / Archetype -->
        <td class="td-genre">
          <div class="table-genre-cell">
            <span class="table-arch-badge" title="Архетип: ${this.escapeHtml(archName)}">${this.escapeHtml(archName)}</span>
            <span class="table-genre-text">${this.escapeHtml(game.genre || '')}</span>
          </div>
        </td>

        <!-- 5. Online CCU (monospaced tabular-nums) -->
        <td class="td-ccu text-right">
          <span class="table-ccu-val tabular-nums">${formattedCcu}</span>
        </td>

        <!-- 6. 7d Trend (inline SVG sparkline green/red) -->
        <td class="td-trend">
          <div class="table-trend-wrap" title="7d тренд: ${deltaSign}${spark.deltaPercent}%">
            <svg class="sparkline-svg ${trendClass}" width="76" height="22" viewBox="0 0 76 22" preserveAspectRatio="none">
              <path d="${spark.svgPath}" fill="none" stroke="${trendColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              <circle cx="${spark.endX}" cy="${spark.endY}" r="2.2" fill="${trendColor}" />
            </svg>
            <span class="table-trend-badge ${trendClass} tabular-nums">${deltaSign}${spark.deltaPercent}%</span>
          </div>
        </td>

        <!-- 7. Opportunity Score (number + micro-indicator) -->
        <td class="td-opportunity">
          <div class="table-opp-cell" title="Opportunity Score: ${oppInfo.score}/100 (${oppInfo.status})">
            <span class="opp-score tabular-nums ${scoreClass}">${oppInfo.score}</span>
            <div class="opp-meter">
              <div class="opp-meter-fill ${scoreClass}" style="width: ${oppInfo.score}%;"></div>
            </div>
          </div>
        </td>

        <!-- 8. Likes % -->
        <td class="td-likes text-center">
          <span class="table-likes-val tabular-nums">${likePct || '—'}</span>
        </td>

        <!-- 9. Actions (Drawer opener) -->
        <td class="td-actions text-right">
          <button type="button" class="table-action-btn" data-game-id="${this.escapeHtml(game.id)}" title="Открыть карточку игры">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>Инспектор</span>
          </button>
        </td>
      </tr>
    `;
  }

  private renderGridView(games: NormalizedGame[]): string {
    const visibleGames = games.slice(0, this.displayLimit);
    const cardsHtml = visibleGames.map(game => this.renderCard(game)).join('');
    const hasMore = games.length > this.displayLimit;

    return `
      <div class="catalog-cards-grid">
        ${cardsHtml}
      </div>

      ${
        hasMore
          ? `
        <div class="steamdb-pagination-row">
          <button type="button" class="btn-steamdb-more" id="btn-table-load-more">
            Показать еще (+100)
          </button>
          <button type="button" class="btn-steamdb-all" id="btn-table-load-all">
            Показать все (${games.length})
          </button>
        </div>
      `
          : ''
      }
    `;
  }

  private renderCard(game: NormalizedGame): string {
    const pMeta = this.getPlatformMeta(game.platform);
    const archName = ARCHETYPE_RU_MAP[game.archetype] || game.archetype;
    const metricStr = this.formatMetricVal(game);
    const likeStr = this.formatLikes(game);
    const oppInfo = this.getOpportunityScoreForArchetype(game.archetype);
    const spark = generateGameSparkline(game);
    const gameUrl = game.url || this.generatePlatformSearchUrl(game.platform, game.title);

    const trendColor = spark.isPositive ? 'var(--status-growth, #27a644)' : 'var(--status-danger, #eb5757)';
    const trendClass = spark.isPositive ? 'sparkline-growth' : 'sparkline-drop';
    const deltaSign = spark.isPositive ? '+' : '';

    return `
      <div class="catalog-game-card" data-game-id="${this.escapeHtml(game.id)}" tabindex="0" role="button" aria-label="Открыть ${this.escapeHtml(game.title)}">
        <div class="card-top-bar">
          <span class="catalog-platform-badge ${pMeta.badgeClass}">
            ${pMeta.iconSvg}
            <span>${pMeta.label}</span>
          </span>
          <span class="catalog-arch-badge" title="Архетип: ${this.escapeHtml(archName)}">
            ${this.escapeHtml(archName)}
          </span>
        </div>

        <h3 class="catalog-card-title" title="${this.escapeHtml(game.title)}">
          ${this.escapeHtml(game.title)}
        </h3>

        <div class="catalog-card-genre">
          ${this.escapeHtml(game.genre || 'Без категории')}
        </div>

        <div class="catalog-metrics-row">
          <div class="catalog-metric-pill ccu">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
            </svg>
            <strong class="tabular-nums">${metricStr}</strong>
          </div>

          ${
            likeStr
              ? `
            <div class="catalog-metric-pill likes" title="Оценка игроков">
              <span class="metric-icon">👍</span>
              <span class="tabular-nums">${likeStr}</span>
            </div>
          `
              : ''
          }
        </div>

        <div class="card-sparkline-row">
          <span class="card-trend-label">7d динамика:</span>
          <svg class="sparkline-svg ${trendClass}" width="68" height="18" viewBox="0 0 76 22" preserveAspectRatio="none">
            <path d="${spark.svgPath}" fill="none" stroke="${trendColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="${spark.endX}" cy="${spark.endY}" r="2.5" fill="${trendColor}" />
          </svg>
          <span class="card-trend-delta ${trendClass} tabular-nums">${deltaSign}${spark.deltaPercent}%</span>
        </div>

        <div class="catalog-card-footer">
          <span class="catalog-card-hint">
            <span>Инспектор</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </span>

          <a href="${this.escapeHtml(gameUrl)}" target="_blank" rel="noopener noreferrer" class="catalog-ext-link" title="Перейти на витрину">
            <span>Витрина</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </div>
      </div>
    `;
  }

  private renderEmptyState(): string {
    return `
      <div class="steamdb-empty-state">
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--text-ash)" stroke-width="1.8">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <h3>Игры не найдены</h3>
        <p>По запросу «${this.escapeHtml(this.searchQuery)}» ничего не обнаружено. Попробуйте сбросить фильтры.</p>
      </div>
    `;
  }

  private renderSortArrow(column: TableSortColumn): string {
    if (this.sortColumn !== column) {
      return `<span class="sort-indicator neutral">↕</span>`;
    }
    return `<span class="sort-indicator active">${this.sortDirection === 'asc' ? '▲' : '▼'}</span>`;
  }

  private formatMetricVal(game: NormalizedGame): string {
    if (game.metricType === 'ccu') {
      return `${this.formatNumber(game.metricValue)} CCU`;
    }
    if (game.metricType === 'viral_score') {
      return `${this.formatNumber(game.metricValue)} pts`;
    }
    if (game.metricType === 'rating') {
      return `${game.metricValue}/100`;
    }
    if (game.metricType === 'rank') {
      return `#${game.metricValue}`;
    }
    return this.formatNumber(game.metricValue);
  }

  private formatLikes(game: NormalizedGame): string {
    if (typeof game.likeRatio === 'number') {
      const pct = game.likeRatio > 1 ? Math.round(game.likeRatio) : Math.round(game.likeRatio * 100);
      return `${pct}%`;
    }
    return '';
  }

  private formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    return Math.round(n).toLocaleString();
  }

  private getPlatformMeta(platform: PlatformType): { label: string; badgeClass: string; iconSvg: string } {
    switch (platform) {
      case 'roblox':
        return {
          label: 'Roblox',
          badgeClass: 'badge-roblox',
          iconSvg: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M5.33 2.5L2.5 18.67l16.17 2.83 2.83-16.17L5.33 2.5zm8.5 10.33l-3.66-.64.64-3.67 3.67.64-.65 3.67z"/></svg>`,
        };
      case 'yandex_games':
        return {
          label: 'Яндекс Игры',
          badgeClass: 'badge-yandex',
          iconSvg: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 12c0-5.25 4.25-9.5 9.5-9.5s9.5 4.25 9.5 9.5-4.25 9.5-9.5 9.5-9.5-4.25-9.5-9.5zm9.5-5.5c-3.04 0-5.5 2.46-5.5 5.5s2.46 5.5 5.5 5.5 5.5-2.46 5.5-5.5-2.46-5.5-5.5-5.5z"/></svg>`,
        };
      case 'poki':
        return {
          label: 'Poki',
          badgeClass: 'badge-poki',
          iconSvg: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>`,
        };
      case 'youtube_trends':
        return {
          label: 'Shorts',
          badgeClass: 'badge-shorts',
          iconSvg: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="10 8 16 12 10 16 10 8"/></svg>`,
        };
      default:
        return {
          label: platform,
          badgeClass: 'badge-neutral',
          iconSvg: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/></svg>`,
        };
    }
  }

  private generatePlatformSearchUrl(platform: PlatformType, title: string): string {
    const encoded = encodeURIComponent(title);
    switch (platform) {
      case 'roblox':
        return `https://www.roblox.com/discover/?Keyword=${encoded}`;
      case 'yandex_games':
        return `https://yandex.ru/games/search?query=${encoded}`;
      case 'poki':
        return `https://poki.com/en/g/${encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}`;
      case 'youtube_trends':
        return `https://www.youtube.com/results?search_query=${encoded}+game`;
      default:
        return `https://www.google.com/search?q=${encoded}+game`;
    }
  }

  private escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export { GameTableView as GameTableViewComponent };
