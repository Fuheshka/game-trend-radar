import { NormalizedGame, PlatformType, GameArchetype, MarketVerdict, PLATFORM_TYPES } from '../types.js';
import { pickOption } from '../utils/dom.js';
import { filterAndSortGames } from './gameTable/filterSort.js';
import { renderEmptyState, renderGridView } from './gameTable/gridView.js';
import { renderTableView } from './gameTable/tableView.js';
import { renderHeaderToolbar } from './gameTable/toolbar.js';
import type {
  GameTableViewOptions,
  TableSortColumn,
  TableSortDirection,
  TableViewMode,
} from './gameTable/types.js';

export type {
  TableSortColumn,
  TableSortDirection,
  TableViewMode,
  GameTableViewOptions,
  SparklineData,
} from './gameTable/types.js';
export { ARCHETYPE_RU_MAP } from '../utils/labels.js';
export { generateGameSparkline } from './gameTable/sparkline.js';

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
    return filterAndSortGames(
      this.allGames,
      {
        platformFilter: this.platformFilter,
        searchQuery: this.searchQuery,
        minCcu: this.minCcu,
        sortColumn: this.sortColumn,
        sortDirection: this.sortDirection,
      },
      archetype => this.getOpportunityScoreForArchetype(archetype)
    );
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
        const p = pickOption(chipBtn.getAttribute('data-platform'), PLATFORM_TYPES);
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
        ${renderHeaderToolbar(filteredCount, totalCount, {
          platformFilter: this.platformFilter,
          viewMode: this.viewMode,
          searchQuery: this.searchQuery,
        })}

        <!-- Active View Content -->
        <div class="steamdb-view-body" id="steamdb-view-body">
          ${this.renderActiveView(filteredGames)}
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
      bodyEl.innerHTML = this.renderActiveView(filteredGames);
    }
  }

  private renderActiveView(filteredGames: NormalizedGame[]): string {
    return filteredGames.length === 0
      ? renderEmptyState(this.searchQuery)
      : this.viewMode === 'table'
      ? renderTableView(
          filteredGames,
          { displayLimit: this.displayLimit, sortColumn: this.sortColumn, sortDirection: this.sortDirection },
          archetype => this.getOpportunityScoreForArchetype(archetype)
        )
      : renderGridView(filteredGames, this.displayLimit, archetype =>
          this.getOpportunityScoreForArchetype(archetype)
        );
  }
}

export { GameTableView as GameTableViewComponent };
