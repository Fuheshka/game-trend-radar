import { NormalizedGame, MarketVerdict } from '../../types.js';
import { escapeHtml, safeHref } from '../../utils/dom.js';
import { PlatformMeta, generatePlatformSearchUrl } from '../../utils/labels.js';

/**
 * Builds the drawer body HTML for Game View mode
 */
export function buildGameBodyHtml(
  game: NormalizedGame,
  previousVerdict: MarketVerdict | null,
  platformMeta: PlatformMeta
): string {
  const likePercent =
    typeof game.likeRatio === 'number'
      ? Math.round(game.likeRatio > 1 ? game.likeRatio : game.likeRatio * 100)
      : 90;

  const metricLabel =
    game.metricType === 'ccu'
      ? 'Онлайн (CCU)'
      : game.metricType === 'viral_score'
      ? 'Вирусный индекс'
      : 'Аудитория';

  const tagsHtml = (game.tags || [])
    .slice(0, 10)
    .map(t => `<span class="drawer-chip clickable-chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`)
    .join('');

  const gameUrl = game.url || generatePlatformSearchUrl(game.platform, game.title);

  return `
        ${
          previousVerdict
            ? `
          <button type="button" class="drawer-back-nav-btn" id="drawer-back-to-archetype">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Назад к архетипу: ${escapeHtml(previousVerdict.titleRu)}</span>
          </button>
        `
            : ''
        }

        <!-- Primary Stat Cards Grid -->
        <div class="drawer-stat-grid">
          <div class="drawer-stat-card ${platformMeta.badgeClass}">
            <div class="stat-card-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              ${metricLabel}
            </div>
            <div class="stat-card-value">${game.metricValue.toLocaleString()}</div>
          </div>

          <div class="drawer-stat-card">
            <div class="stat-card-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
              </svg>
              Like Ratio
            </div>
            <div class="stat-card-value" style="color: ${likePercent >= 85 ? '#10b981' : likePercent >= 70 ? '#f59e0b' : '#ef4444'};">
              ${likePercent}%
            </div>
            <div class="drawer-mini-bar">
              <div class="drawer-mini-bar-fill" style="width: ${Math.min(100, Math.max(5, likePercent))}%; background: ${likePercent >= 85 ? '#10b981' : likePercent >= 70 ? '#f59e0b' : '#ef4444'};"></div>
            </div>
          </div>
        </div>

        <!-- Platform & Genre Meta -->
        <div class="drawer-section">
          <div class="drawer-info-row">
            <span class="drawer-info-label">Платформа</span>
            <span class="drawer-platform-pill ${platformMeta.badgeClass}">
              ${platformMeta.iconSvg}
              ${platformMeta.label}
            </span>
          </div>
          ${
            game.genre
              ? `
          <div class="drawer-info-row">
            <span class="drawer-info-label">Жанр</span>
            <span class="drawer-info-value">${escapeHtml(game.genre)}</span>
          </div>
          `
              : ''
          }
        </div>

        <!-- Associated Archetype Box -->
        <div class="drawer-section">
          <h4 class="drawer-section-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
            Сопоставленный архетип
          </h4>
          <div class="drawer-archetype-card" id="drawer-view-archetype-btn" data-archetype="${game.archetype}">
            <div class="archetype-card-main">
              <span class="archetype-code">${game.archetype}</span>
              <span class="archetype-hint">Открыть глубокий анализ архетипа</span>
            </div>
            <svg class="archetype-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>

        <!-- Tags / Keywords -->
        ${
          tagsHtml
            ? `
          <div class="drawer-section">
            <h4 class="drawer-section-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
              Теги и атрибуты
            </h4>
            <div class="drawer-chips-cloud">${tagsHtml}</div>
          </div>
        `
            : ''
        }

        <!-- Direct Actions -->
        <div class="drawer-footer-actions">
          <a href="${safeHref(gameUrl)}" target="_blank" rel="noopener noreferrer" class="drawer-btn primary">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            <span>Открыть страницу на платформе</span>
          </a>

          <button type="button" class="drawer-btn secondary" id="drawer-btn-copy-game">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Скопировать название</span>
          </button>
        </div>
  `;
}
