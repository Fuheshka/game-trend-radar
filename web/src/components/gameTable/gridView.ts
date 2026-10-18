import { NormalizedGame } from '../../types.js';
import { escapeHtml, safeHref } from '../../utils/dom.js';
import { ARCHETYPE_RU_MAP } from '../../utils/labels.js';
import { formatLikes, formatMetricVal } from './formatters.js';
import { generatePlatformSearchUrl, getPlatformMeta } from '../../utils/labels.js';
import { generateGameSparkline } from './sparkline.js';
import type { OpportunityScoreGetter } from './types.js';
import { CATALOG_PAGE_SIZE } from './types.js';

export function renderGridView(
  games: NormalizedGame[],
  displayLimit: number,
  getOpportunityScore: OpportunityScoreGetter
): string {
  const visibleGames = games.slice(0, displayLimit);
  const cardsHtml = visibleGames.map(game => renderCard(game, getOpportunityScore)).join('');
  const hasMore = games.length > displayLimit;

  return `
    <div class="catalog-cards-grid">
      ${cardsHtml}
    </div>

    ${
      hasMore
        ? `
      <div class="steamdb-pagination-row">
        <button type="button" class="btn-steamdb-more" id="btn-table-load-more">
          Показать еще (+${CATALOG_PAGE_SIZE})
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

function renderCard(game: NormalizedGame, getOpportunityScore: OpportunityScoreGetter): string {
  const pMeta = getPlatformMeta(game.platform);
  const archName = ARCHETYPE_RU_MAP[game.archetype] || game.archetype;
  const metricStr = formatMetricVal(game);
  const likeStr = formatLikes(game);
  const oppInfo = getOpportunityScore(game.archetype);
  const spark = generateGameSparkline(game);
  const gameUrl = game.url || generatePlatformSearchUrl(game.platform, game.title);

  const trendColor = spark.isPositive ? 'var(--status-growth, #27a644)' : 'var(--status-danger, #eb5757)';
  const trendClass = spark.isPositive ? 'sparkline-growth' : 'sparkline-drop';
  const deltaSign = spark.isPositive ? '+' : '';

  return `
    <div class="catalog-game-card" data-game-id="${escapeHtml(game.id)}" tabindex="0" role="button" aria-label="Открыть ${escapeHtml(game.title)}">
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

        <a href="${safeHref(gameUrl)}" target="_blank" rel="noopener noreferrer" class="catalog-ext-link" title="Перейти на витрину">
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

export function renderEmptyState(searchQuery: string): string {
  return `
    <div class="steamdb-empty-state">
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--text-ash)" stroke-width="1.8">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <h3>Игры не найдены</h3>
      <p>По запросу «${escapeHtml(searchQuery)}» ничего не обнаружено. Попробуйте сбросить фильтры.</p>
    </div>
  `;
}
