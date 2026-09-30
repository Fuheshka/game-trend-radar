import { TickerSignal } from './LiveTicker.js';
import { GameArchetype } from '../types.js';

export interface GameDrawerOptions {
  backdrop: HTMLElement;
  drawer: HTMLElement;
  onFilterSearch: (query: string, archetype?: GameArchetype) => void;
  showToast?: (message: string) => void;
}

export class GameDrawerComponent {
  private backdrop: HTMLElement;
  private drawer: HTMLElement;
  private onFilterSearch: (query: string, archetype?: GameArchetype) => void;
  private showToast?: (message: string) => void;
  private currentSignal: TickerSignal | null = null;
  private boundOnKeyDown: (e: KeyboardEvent) => void;

  constructor(options: GameDrawerOptions) {
    this.backdrop = options.backdrop;
    this.drawer = options.drawer;
    this.onFilterSearch = options.onFilterSearch;
    this.showToast = options.showToast;

    this.boundOnKeyDown = this.handleKeyDown.bind(this);
    this.initEvents();
  }

  private initEvents(): void {
    this.backdrop.addEventListener('click', () => this.close());

    const closeBtn = this.drawer.querySelector('#drawer-close-btn');
    closeBtn?.addEventListener('click', () => this.close());
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.close();
    }
  }

  public open(signal: TickerSignal): void {
    this.currentSignal = signal;

    const badgeEl = this.drawer.querySelector('#drawer-badge');
    const titleEl = this.drawer.querySelector('#drawer-title');
    const bodyEl = this.drawer.querySelector('#drawer-body');

    if (badgeEl) {
      badgeEl.textContent = `${signal.emoji} ${signal.details.categoryRu.toUpperCase()}`;
      badgeEl.className = `drawer-tag ${signal.badgeClass}`;
    }

    if (titleEl) {
      titleEl.textContent = signal.title;
    }

    if (bodyEl) {
      const tagsHtml = (signal.details.tags || [])
        .slice(0, 8)
        .map(t => `<span class="drawer-chip">${this.escapeHtml(t)}</span>`)
        .join('');

      bodyEl.innerHTML = `
        <!-- Main Highlight Metric Card -->
        <div class="drawer-stat-card ${signal.badgeClass}">
          <div class="stat-card-label">${this.escapeHtml(signal.details.metricLabel)}</div>
          <div class="stat-card-value">${this.escapeHtml(signal.details.metricValue)}</div>
        </div>

        <!-- Analytical Description -->
        <div class="drawer-section">
          <h4 class="drawer-section-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Инсайт и Сигнал Рынка
          </h4>
          <p class="drawer-section-text">${this.escapeHtml(signal.details.description)}</p>
        </div>

        <!-- Strategy / Recommendation -->
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
            <p class="drawer-section-text">${this.escapeHtml(signal.details.actionRu)}</p>
          </div>
        `
            : ''
        }

        <!-- Tags / Keywords -->
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

        <!-- Drawer Action Buttons -->
        <div class="drawer-footer-actions">
          <button type="button" class="drawer-btn primary" id="drawer-btn-filter">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>Найти в каталоге</span>
          </button>

          <button type="button" class="drawer-btn secondary" id="drawer-btn-copy">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Копировать название</span>
          </button>

          ${
            signal.details.externalUrl
              ? `
            <a href="${signal.details.externalUrl}" target="_blank" rel="noopener noreferrer" class="drawer-btn link">
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

      // Wire up buttons
      const btnFilter = bodyEl.querySelector('#drawer-btn-filter');
      btnFilter?.addEventListener('click', () => {
        this.onFilterSearch(signal.searchFilter, signal.archetype);
        this.close();
        const verdictsEl = document.getElementById('verdicts-container');
        verdictsEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      const btnCopy = bodyEl.querySelector('#drawer-btn-copy');
      btnCopy?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(signal.title);
          if (btnCopy) {
            btnCopy.classList.add('copied');
            const span = btnCopy.querySelector('span');
            if (span) span.textContent = 'Скопировано!';
            setTimeout(() => {
              btnCopy.classList.remove('copied');
              if (span) span.textContent = 'Копировать название';
            }, 2000);
          }
          if (this.showToast) this.showToast(`Название "${signal.title}" скопировано в буфер`);
        } catch {
          // Clipboard fallback
        }
      });
    }

    this.backdrop.classList.add('active');
    this.drawer.classList.add('active');
    this.drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', this.boundOnKeyDown);
  }

  public close(): void {
    this.backdrop.classList.remove('active');
    this.drawer.classList.remove('active');
    this.drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    window.removeEventListener('keydown', this.boundOnKeyDown);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
