import { NormalizedGame, PlatformType, GameArchetype, MarketVerdict } from '../types.js';
import { filterAndSortGames } from './gameTable/filterSort.js';
import { renderEmptyState, renderGridView } from './gameTable/gridView.js';
import { renderTableView } from './gameTable/tableView.js';
import type {
  GameTableViewOptions,
  TableSortColumn,
  TableSortDirection,
  TableViewMode,
} from './gameTable/types.js';
import { CATALOG_PAGE_SIZE } from './gameTable/types.js';

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
  private displayLimit: number = CATALOG_PAGE_SIZE;

  private onViewModeChange?: (mode: TableViewMode) => void;
  private onSortChange?: (column: TableSortColumn, direction: TableSortDirection) => void;
  private onPlatformChange?: (platform: 'all' | PlatformType) => void;
  private onFilterChange?: (filteredCount: number, totalCount: number) => void;

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
    // Новый снимок — с первой страницы, как и при смене фильтра (иначе «Показать ещё/все» переживал смену среза)
    this.displayLimit = CATALOG_PAGE_SIZE;
    this.render();
    this.notifyFilterChange();
  }

  public setPlatform(platform: 'all' | PlatformType): void {
    this.platformFilter = platform;
    this.displayLimit = CATALOG_PAGE_SIZE;
    this.render();
    this.onPlatformChange?.(platform);
    this.notifyFilterChange();
  }

  public setSearchQuery(query: string): void {
    this.searchQuery = query.trim().toLowerCase();
    this.displayLimit = CATALOG_PAGE_SIZE;
    this.render();
    this.notifyFilterChange();
  }

  public setMinCcu(val: number): void {
    this.minCcu = Math.max(0, val);
    this.displayLimit = CATALOG_PAGE_SIZE;
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

      // 3. Column header sort click
      const thEl = target.closest('th.sortable') as HTMLElement;
      if (thEl) {
        e.stopPropagation();
        const col = thEl.getAttribute('data-sort-col') as TableSortColumn;
        if (col) this.setSort(col);
        return;
      }

      // 4. Action button click
      const actionBtn = target.closest('.table-action-btn') as HTMLElement;
      if (actionBtn) {
        e.stopPropagation();
        const gameId = actionBtn.getAttribute('data-game-id');
        const game = this.allGames.find(g => g.id === gameId);
        if (game) this.onSelectGame(game);
        return;
      }

      // 5. Load more / Load all
      const loadMoreBtn = target.closest('#btn-table-load-more') as HTMLElement;
      if (loadMoreBtn) {
        e.stopPropagation();
        this.displayLimit += CATALOG_PAGE_SIZE;
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

      // 6. Row click or Card click
      const rowOrCard = target.closest('.steamdb-table-row, .catalog-game-card') as HTMLElement;
      if (rowOrCard) {
        const gameId = rowOrCard.getAttribute('data-game-id');
        if (gameId) {
          const game = this.allGames.find(g => g.id === gameId);
          if (game) this.onSelectGame(game);
        }
      }
    });
  }

  private render(): void {
    // Фильтры, поиск и переключатель вида живут в .catalog-toolbar из index.html
    this.container.innerHTML = `
      <div class="steamdb-table-container" data-view-mode="${this.viewMode}">
        <div class="steamdb-view-body">
          ${this.renderActiveView(this.getFilteredGames())}
        </div>
      </div>
    `;
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
