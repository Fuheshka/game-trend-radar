import { TickerSignal } from '../LiveTicker.js';
import { escapeHtml, safeHref } from '../../utils/dom.js';

/**
 * Builds the drawer body HTML for Signal View mode
 */
export function buildSignalBodyHtml(signal: TickerSignal): string {
  const tagsHtml = (signal.details.tags || [])
    .slice(0, 8)
    .map(t => `<span class="drawer-chip clickable-chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`)
    .join('');

  return `
        <div class="drawer-stat-card ${signal.badgeClass}">
          <div class="stat-card-label">${escapeHtml(signal.details.metricLabel)}</div>
          <div class="stat-card-value">${escapeHtml(signal.details.metricValue)}</div>
        </div>

        <div class="drawer-section">
          <h4 class="drawer-section-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Инсайт и Сигнал Рынка
          </h4>
          <p class="drawer-section-text">${escapeHtml(signal.details.description)}</p>
        </div>

        ${
          signal.details.actionRu
            ? `
          <div class="drawer-section drawer-action-box">
            <h4 class="drawer-section-title" style="color: var(--accent-cyan);">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
              Рекомендация по адаптации
            </h4>
            <p class="drawer-section-text">${escapeHtml(signal.details.actionRu)}</p>
          </div>
        `
            : ''
        }

        ${
          tagsHtml
            ? `
          <div class="drawer-section">
            <h4 class="drawer-section-title">Теги и ключевые фразы</h4>
            <div class="drawer-chips-cloud">${tagsHtml}</div>
          </div>
        `
            : ''
        }

        <div class="drawer-footer-actions">
          <button type="button" class="drawer-btn primary" id="drawer-btn-filter-signal">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>Найти в каталоге</span>
          </button>

          <button type="button" class="drawer-btn secondary" id="drawer-btn-copy-signal">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Копировать название</span>
          </button>

          ${
            signal.details.externalUrl
              ? `
            <a href="${safeHref(signal.details.externalUrl)}" target="_blank" rel="noopener noreferrer" class="drawer-btn link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              <span>Открыть страницу</span>
            </a>
          `
              : ''
          }
        </div>
  `;
}
