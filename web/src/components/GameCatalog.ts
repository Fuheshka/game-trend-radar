import { NormalizedGame, PlatformType, GameArchetype } from '../types.js';
import { escapeHtml, safeHref } from '../utils/dom.js';
import { formatCompactNumber } from '../utils/format.js';
import { ARCHETYPE_RU_MAP, generatePlatformSearchUrl, getPlatformMeta } from '../utils/labels.js';

export interface GameCatalogOptions {
  container: HTMLElement;
  games: NormalizedGame[];
  onSelectGame: (game: NormalizedGame) => void;
  onTagClick?: (tag: string) => void;
}

export type CatalogViewMode = 'grid' | 'table';
export type CatalogSortBy = 'ccu_desc' | 'ccu_asc' | 'title_asc' | 'likes_desc';

export class GameCatalogComponent {
  private container: HTMLElement;
  private allGames: NormalizedGame[] = [];
  private onSelectGame: (game: NormalizedGame) => void;
  private onTagClick?: (tag: string) => void;

  private minCcu: number = 0;
  private platformFilter: 'all' | PlatformType = 'all';
  private archetypeFilter: 'all' | GameArchetype = 'all';
  private searchQuery: string = '';
  private sortBy: CatalogSortBy = 'ccu_desc';
  private viewMode: CatalogViewMode = 'grid';
  private displayLimit: number = 48;

  constructor(options: GameCatalogOptions) {
    this.container = options.container;
    this.allGames = options.games || [];
    this.onSelectGame = options.onSelectGame;
    this.onTagClick = options.onTagClick;

    this.initEvents();
    this.render();
  }

  public updateData(games: NormalizedGame[]): void {
    this.allGames = games || [];
    this.render();
  }

  public setMinCcu(val: number): void {
    this.minCcu = Math.max(0, val);
    this.displayLimit = 48;
    this.render();
  }

  public setPlatform(platform: 'all' | PlatformType): void {
    this.platformFilter = platform;
    this.displayLimit = 48;
    this.render();
  }

  public setArchetype(archetype: 'all' | GameArchetype): void {
    this.archetypeFilter = archetype;
    this.displayLimit = 48;
    this.render();
  }

  public setSearchQuery(query: string): void {
    this.searchQuery = query.trim().toLowerCase();
    this.displayLimit = 48;
    this.render();
  }

  public setSort(sort: CatalogSortBy): void {
    this.sortBy = sort;
    this.render();
  }

  public setViewMode(mode: CatalogViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.render();
  }

  public getTotalGamesCount(): number {
    return this.allGames.length;
  }

  public getFilteredCount(): number {
    return this.getFilteredGames().length;
  }

  private initEvents(): void {
    this.container.addEventListener('click', e => {
      const target = e.target as HTMLElement;

      // 1. External link click - prevent opening drawer
      const extLink = target.closest('.catalog-ext-link') as HTMLElement;
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

      // 3. Load more button
      const loadMoreBtn = target.closest('#btn-catalog-load-more') as HTMLElement;
      if (loadMoreBtn) {
        e.stopPropagation();
        this.displayLimit += 48;
        this.render();
        return;
      }

      // 4. Load all button
      const loadAllBtn = target.closest('#btn-catalog-load-all') as HTMLElement;
      if (loadAllBtn) {
        e.stopPropagation();
        this.displayLimit = this.allGames.length;
        this.render();
        return;
      }

      // 5. Click on game card or table row
      const card = target.closest('.catalog-game-card, .catalog-table-row') as HTMLElement;
      if (card) {
        const gameId = card.getAttribute('data-game-id');
        if (gameId) {
          const game = this.allGames.find(g => g.id === gameId);
          if (game) {
            this.onSelectGame(game);
          }
        }
      }
    });
  }

  private getFilteredGames(): NormalizedGame[] {
    return this.allGames.filter(game => {
      // 1. Min CCU filter
      if (this.minCcu > 0) {
        const effectiveCcu = game.metricType === 'ccu' ? game.metricValue : 0;
        if (effectiveCcu < this.minCcu) {
          return false;
        }
      }

      // 2. Platform filter
      if (this.platformFilter !== 'all' && game.platform !== this.platformFilter) {
        return false;
      }

      // 3. Archetype filter
      if (this.archetypeFilter !== 'all' && game.archetype !== this.archetypeFilter) {
        return false;
      }

      // 4. Search query
      if (this.searchQuery) {
        const q = this.searchQuery;
        const inTitle = game.title.toLowerCase().includes(q);
        const inGenre = game.genre?.toLowerCase().includes(q) ?? false;
        const inArch = game.archetype.toLowerCase().includes(q);
        const inArchRu = (ARCHETYPE_RU_MAP[game.archetype] || '').toLowerCase().includes(q);
        const inTags = (game.tags || []).some(t => t.toLowerCase().includes(q));

        if (!inTitle && !inGenre && !inArch && !inArchRu && !inTags) {
          return false;
        }
      }

      return true;
    });
  }

  private getSortedGames(games: NormalizedGame[]): NormalizedGame[] {
    return [...games].sort((a, b) => {
      switch (this.sortBy) {
        case 'ccu_desc': {
          const valA = a.metricType === 'ccu' ? a.metricValue : 0;
          const valB = b.metricType === 'ccu' ? b.metricValue : 0;
          return valB - valA || b.metricValue - a.metricValue;
        }
        case 'ccu_asc': {
          const valA = a.metricType === 'ccu' ? a.metricValue : 0;
          const valB = b.metricType === 'ccu' ? b.metricValue : 0;
          return valA - valB || a.metricValue - b.metricValue;
        }
        case 'title_asc':
          return a.title.localeCompare(b.title, 'ru');
        case 'likes_desc': {
          const likeA = a.likeRatio ?? 0;
          const likeB = b.likeRatio ?? 0;
          return likeB - likeA;
        }
        default:
          return 0;
      }
    });
  }

  public render(): void {
    const filtered = this.getFilteredGames();
    const sorted = this.getSortedGames(filtered);
    const displayed = sorted.slice(0, this.displayLimit);
    const totalFiltered = sorted.length;
    const hasMore = this.displayLimit < totalFiltered;

    let contentHtml = '';

    if (totalFiltered === 0) {
      contentHtml = `
        <div class="catalog-empty-state">
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </div>
          <h3>Игры не найдены</h3>
          <p>Попробуйте уменьшить минимальный CCU или изменить параметры поиска</p>
        </div>
      `;
    } else if (this.viewMode === 'grid') {
      contentHtml = `
        <div class="catalog-cards-grid">
          ${displayed.map(g => this.renderGameCard(g)).join('')}
        </div>
      `;
    } else {
      contentHtml = `
        <div class="catalog-table-wrapper">
          <table class="catalog-table">
            <thead>
              <tr>
                <th style="width: 140px;">Платформа</th>
                <th>Название игры</th>
                <th style="width: 170px;">Архетип / Жанр</th>
                <th style="width: 130px; text-align: right;">Онлайн / Метрика</th>
                <th style="width: 100px; text-align: center;">Лайки</th>
                <th style="width: 120px; text-align: right;">Действие</th>
              </tr>
            </thead>
            <tbody>
              ${displayed.map(g => this.renderTableRow(g)).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Load more controls
    let footerHtml = '';
    if (hasMore) {
      const remaining = totalFiltered - this.displayLimit;
      footerHtml = `
        <div class="catalog-pagination-row">
          <button type="button" class="btn-catalog-more" id="btn-catalog-load-more">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
            <span>Показать еще 48 игр (осталось ${remaining})</span>
          </button>
          <button type="button" class="btn-catalog-all" id="btn-catalog-load-all">
            Показать все (${totalFiltered})
          </button>
        </div>
      `;
    }

    this.container.innerHTML = contentHtml + footerHtml;
  }

  private renderGameCard(game: NormalizedGame): string {
    const pMeta = getPlatformMeta(game.platform);
    const archName = ARCHETYPE_RU_MAP[game.archetype] || game.archetype;
    const metricStr = this.formatGameMetric(game);
    const likeStr = this.formatGameLikes(game);
    const gameUrl = game.url || generatePlatformSearchUrl(game.platform, game.title);

    const tags = (game.tags || []).slice(0, 3);
    const tagsHtml = tags
      .map(
        t =>
          `<span class="catalog-tag-chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`
      )
      .join('');

    return `
      <div class="catalog-game-card" data-game-id="${escapeHtml(game.id)}" tabindex="0" role="button" aria-label="Открыть подробнее: ${escapeHtml(game.title)}">
        <div class="card-top-bar">
          <span class="catalog-platform-badge ${pMeta.badgeClass}">
            ${pMeta.iconSvg}
            <span>${pMeta.label}</span>
          </span>
          <span class="catalog-arch-badge" title="Архетип: ${escapeHtml(archName)}">
            ${escapeHtml(archName)}
          </span>
        </div>

        <h3 class="catalog-card-title" title="${escapeHtml(game.title)}">
          ${escapeHtml(game.title)}
        </h3>

        <div class="catalog-card-genre">
          ${escapeHtml(game.genre || 'Без категории')}
        </div>

        <div class="catalog-metrics-row">
          <div class="catalog-metric-pill ${game.metricType === 'ccu' ? 'ccu' : 'generic'}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            </svg>
            <strong>${metricStr}</strong>
          </div>

          ${
            likeStr
              ? `
            <div class="catalog-metric-pill likes" title="Оценка игроков">
              <span class="metric-icon">👍</span>
              <span>${likeStr}</span>
            </div>
          `
              : ''
          }
        </div>

        ${
          tagsHtml
            ? `
          <div class="catalog-tags-row">
            ${tagsHtml}
          </div>
        `
            : ''
        }

        <div class="catalog-card-footer">
          <span class="catalog-card-hint">
            <span>Подробнее</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </span>

          <a href="${safeHref(gameUrl)}" target="_blank" rel="noopener noreferrer" class="catalog-ext-link" title="Перейти на страницу игры">
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

  private renderTableRow(game: NormalizedGame): string {
    const pMeta = getPlatformMeta(game.platform);
    const archName = ARCHETYPE_RU_MAP[game.archetype] || game.archetype;
    const metricStr = this.formatGameMetric(game);
    const likeStr = this.formatGameLikes(game);
    const gameUrl = game.url || generatePlatformSearchUrl(game.platform, game.title);

    return `
      <tr class="catalog-table-row" data-game-id="${escapeHtml(game.id)}" tabindex="0" role="button">
        <td>
          <span class="catalog-platform-badge compact ${pMeta.badgeClass}">
            ${pMeta.iconSvg}
            <span>${pMeta.label}</span>
          </span>
        </td>
        <td>
          <div class="table-title-cell">
            <span class="table-game-title">${escapeHtml(game.title)}</span>
          </div>
        </td>
        <td>
          <div class="table-genre-cell">
            <span class="table-arch-badge">${escapeHtml(archName)}</span>
            <span class="table-genre-text">${escapeHtml(game.genre || '')}</span>
          </div>
        </td>
        <td style="text-align: right;">
          <span class="table-metric-val ${game.metricType === 'ccu' ? 'ccu' : ''}">${metricStr}</span>
        </td>
        <td style="text-align: center;">
          <span class="table-likes-val">${likeStr || '—'}</span>
        </td>
        <td style="text-align: right;">
          <div class="table-actions-cell">
            <a href="${safeHref(gameUrl)}" target="_blank" rel="noopener noreferrer" class="catalog-ext-link compact" title="Открыть в витрине">
              <span>Витрина</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </a>
          </div>
        </td>
      </tr>
    `;
  }

  private formatGameMetric(game: NormalizedGame): string {
    if (game.metricType === 'ccu') {
      return `${formatCompactNumber(game.metricValue)} CCU`;
    }
    if (game.metricType === 'rating') {
      return `${game.metricValue}/100`;
    }
    if (game.metricType === 'rank') {
      return `#${game.metricValue}`;
    }
    if (game.metricType === 'viral_score') {
      return `${game.metricValue} score`;
    }
    return formatCompactNumber(game.metricValue);
  }

  private formatGameLikes(game: NormalizedGame): string {
    if (typeof game.likeRatio === 'number') {
      const pct = game.likeRatio > 1 ? Math.round(game.likeRatio) : Math.round(game.likeRatio * 100);
      return `${pct}%`;
    }
    return '';
  }
}
