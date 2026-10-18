import { NormalizedGame } from '../../types.js';
import { escapeHtml, safeHref } from '../../utils/dom.js';
import { ARCHETYPE_RU_MAP } from './constants.js';
import { formatLikes, formatMetricVal, generatePlatformSearchUrl, getPlatformMeta } from './formatters.js';
import { generateGameSparkline } from './sparkline.js';
import type { OpportunityScoreGetter, TableSortColumn, TableSortDirection } from './types.js';

export interface TableViewState {
  displayLimit: number;
  sortColumn: TableSortColumn;
  sortDirection: TableSortDirection;
}

export function renderTableView(
  games: NormalizedGame[],
  state: TableViewState,
  getOpportunityScore: OpportunityScoreGetter
): string {
  const visibleGames = games.slice(0, state.displayLimit);
  const rowsHtml = visibleGames.map((game, idx) => renderTableRow(game, idx, getOpportunityScore)).join('');

  const hasMore = games.length > state.displayLimit;

  return `
    <div class="steamdb-table-wrapper">
      <table class="steamdb-table steamdb-data-table">
        <thead>
          <tr>
            <th class="th-rank sortable ${state.sortColumn === 'rank' ? 'sort-active' : ''}" data-sort-col="rank" title="Сортировка по рангу">
              <div class="th-inner"><span># Ранг</span>${renderSortArrow(state, 'rank')}</div>
            </th>
            <th class="th-platform sortable ${state.sortColumn === 'platform' ? 'sort-active' : ''}" data-sort-col="platform" title="Сортировка по платформе">
              <div class="th-inner"><span>Платформа</span>${renderSortArrow(state, 'platform')}</div>
            </th>
            <th class="th-title sortable ${state.sortColumn === 'title' ? 'sort-active' : ''}" data-sort-col="title" title="Сортировка по названию">
              <div class="th-inner"><span>Название игры</span>${renderSortArrow(state, 'title')}</div>
            </th>
            <th class="th-genre sortable ${state.sortColumn === 'genre' ? 'sort-active' : ''}" data-sort-col="genre" title="Сортировка по жанру/архетипу">
              <div class="th-inner"><span>Жанр / Архетип</span>${renderSortArrow(state, 'genre')}</div>
            </th>
            <th class="th-ccu sortable text-right ${state.sortColumn === 'ccu' ? 'sort-active' : ''}" data-sort-col="ccu" title="Сортировка по онлайну CCU">
              <div class="th-inner justify-end"><span>Онлайн CCU</span>${renderSortArrow(state, 'ccu')}</div>
            </th>
            <th class="th-trend sortable ${state.sortColumn === 'trend' ? 'sort-active' : ''}" data-sort-col="trend" title="Сортировка по 7d тренду">
              <div class="th-inner justify-center"><span>7d Тренд</span>${renderSortArrow(state, 'trend')}</div>
            </th>
            <th class="th-opportunity sortable ${state.sortColumn === 'opportunity' ? 'sort-active' : ''}" data-sort-col="opportunity" title="Сортировка по Opportunity Score">
              <div class="th-inner justify-center"><span>Opportunity Score</span>${renderSortArrow(state, 'opportunity')}</div>
            </th>
            <th class="th-likes sortable text-center ${state.sortColumn === 'likes' ? 'sort-active' : ''}" data-sort-col="likes" title="Сортировка по проценту лайков">
              <div class="th-inner justify-center"><span>Лайки %</span>${renderSortArrow(state, 'likes')}</div>
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

function renderTableRow(game: NormalizedGame, index: number, getOpportunityScore: OpportunityScoreGetter): string {
  const pMeta = getPlatformMeta(game.platform);
  const archName = ARCHETYPE_RU_MAP[game.archetype] || game.archetype;
  const formattedCcu = formatMetricVal(game);
  const likePct = formatLikes(game);
  const oppInfo = getOpportunityScore(game.archetype);
  const spark = generateGameSparkline(game);
  const storeUrl = game.url || generatePlatformSearchUrl(game.platform, game.title);

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
    <tr class="steamdb-table-row" data-game-id="${escapeHtml(game.id)}" tabindex="0" role="button">
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
          <span class="table-game-title" title="${escapeHtml(game.title)}">${escapeHtml(game.title)}</span>
          <a href="${safeHref(storeUrl)}" target="_blank" rel="noopener noreferrer" class="table-store-link" title="Открыть витрину в новой вкладке">
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
          <span class="table-arch-badge" title="Архетип: ${escapeHtml(archName)}">${escapeHtml(archName)}</span>
          <span class="table-genre-text">${escapeHtml(game.genre || '')}</span>
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
        <button type="button" class="table-action-btn" data-game-id="${escapeHtml(game.id)}" title="Открыть карточку игры">
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

function renderSortArrow(state: TableViewState, column: TableSortColumn): string {
  if (state.sortColumn !== column) {
    return `<span class="sort-indicator neutral">↕</span>`;
  }
  return `<span class="sort-indicator active">${state.sortDirection === 'asc' ? '▲' : '▼'}</span>`;
}
