import { NormalizedGame, MarketVerdict, GameArchetype, PlatformType } from '../types.js';
import { TickerSignal } from './LiveTicker.js';

export interface DetailDrawerOptions {
  backdrop: HTMLElement;
  drawer: HTMLElement;
  onFilterSearch?: (query: string, archetype?: GameArchetype) => void;
  showToast?: (message: string) => void;
  onSelectGame?: (game: NormalizedGame) => void;
  onSelectArchetype?: (archetype: GameArchetype) => void;
}

export type DrawerMode = 'game' | 'archetype' | 'signal';

export class DetailDrawerComponent {
  private backdrop: HTMLElement;
  private drawer: HTMLElement;
  private onFilterSearch?: (query: string, archetype?: GameArchetype) => void;
  private showToast?: (message: string) => void;
  private onSelectGame?: (game: NormalizedGame) => void;
  private onSelectArchetype?: (archetype: GameArchetype) => void;

  private boundOnKeyDown: (e: KeyboardEvent) => void;
  private currentMode: DrawerMode | null = null;
  private currentGame: NormalizedGame | null = null;
  private currentVerdict: MarketVerdict | null = null;
  private previousVerdict: MarketVerdict | null = null;
  private currentSignal: TickerSignal | null = null;

  // Touch swipe support
  private touchStartX = 0;
  private touchStartY = 0;
  private isSwiping = false;

  constructor(options: DetailDrawerOptions) {
    this.backdrop = options.backdrop;
    this.drawer = options.drawer;
    this.onFilterSearch = options.onFilterSearch;
    this.showToast = options.showToast;
    this.onSelectGame = options.onSelectGame;
    this.onSelectArchetype = options.onSelectArchetype;

    this.boundOnKeyDown = this.handleKeyDown.bind(this);
    this.initEvents();
  }

  private initEvents(): void {
    // Backdrop click closes drawer
    this.backdrop.addEventListener('click', () => this.close());

    // Close button
    const closeBtn = this.drawer.querySelector('#drawer-close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    // Touch swipe-to-dismiss (swipe right)
    this.drawer.addEventListener(
      'touchstart',
      e => {
        if (e.touches.length === 1) {
          this.touchStartX = e.touches[0].clientX;
          this.touchStartY = e.touches[0].clientY;
          this.isSwiping = true;
        }
      },
      { passive: true }
    );

    this.drawer.addEventListener(
      'touchend',
      e => {
        if (!this.isSwiping || e.changedTouches.length === 0) return;
        this.isSwiping = false;
        const deltaX = e.changedTouches[0].clientX - this.touchStartX;
        const deltaY = e.changedTouches[0].clientY - this.touchStartY;

        // If swiped right at least 70px and not predominantly vertical scroll
        if (deltaX > 70 && Math.abs(deltaY) < 120) {
          this.close();
        }
      },
      { passive: true }
    );
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.close();
    }
  }

  /**
   * Opens the drawer in Game View mode
   */
  public openGame(
    game: NormalizedGame,
    allArchetypeGames?: NormalizedGame[],
    fromArchetype?: MarketVerdict
  ): void {
    this.currentMode = 'game';
    this.currentGame = game;
    if (fromArchetype) {
      this.previousVerdict = fromArchetype;
    }

    const badgeEl = this.drawer.querySelector('#drawer-badge');
    const titleEl = this.drawer.querySelector('#drawer-title');
    const bodyEl = this.drawer.querySelector('#drawer-body');

    const platformMeta = this.getPlatformMeta(game.platform);

    if (badgeEl) {
      badgeEl.textContent = `${platformMeta.label.toUpperCase()}`;
      badgeEl.className = `drawer-tag ${platformMeta.badgeClass}`;
    }

    if (titleEl) {
      titleEl.textContent = game.title;
    }

    if (bodyEl) {
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
        .map(t => `<span class="drawer-chip clickable-chip" data-tag="${this.escapeHtml(t)}">${this.escapeHtml(t)}</span>`)
        .join('');

      const gameUrl = game.url || this.generatePlatformSearchUrl(game.platform, game.title);

      bodyEl.innerHTML = `
        ${
          this.previousVerdict
            ? `
          <button type="button" class="drawer-back-nav-btn" id="drawer-back-to-archetype">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Назад к архетипу: ${this.escapeHtml(this.previousVerdict.titleRu)}</span>
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
            <span class="drawer-info-value">${this.escapeHtml(game.genre)}</span>
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
          <a href="${gameUrl}" target="_blank" rel="noopener noreferrer" class="drawer-btn primary">
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

      // Back navigation button
      const backBtn = bodyEl.querySelector('#drawer-back-to-archetype');
      backBtn?.addEventListener('click', () => {
        if (this.previousVerdict) {
          this.openArchetype(this.previousVerdict, allArchetypeGames);
        }
      });

      // Archetype card click
      const archetypeCard = bodyEl.querySelector('#drawer-view-archetype-btn');
      archetypeCard?.addEventListener('click', () => {
        if (this.onSelectArchetype) {
          this.onSelectArchetype(game.archetype);
        }
      });

      // Clickable tags
      const tagChips = bodyEl.querySelectorAll<HTMLElement>('.clickable-chip');
      tagChips.forEach(chip => {
        chip.addEventListener('click', () => {
          const tag = chip.getAttribute('data-tag');
          if (tag && this.onFilterSearch) {
            this.onFilterSearch(tag, game.archetype);
            this.close();
            const container = document.getElementById('verdicts-container');
            container?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });

      // Copy name
      const btnCopy = bodyEl.querySelector('#drawer-btn-copy-game');
      btnCopy?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(game.title);
          if (btnCopy) {
            btnCopy.classList.add('copied');
            const span = btnCopy.querySelector('span');
            if (span) span.textContent = 'Скопировано!';
            setTimeout(() => {
              btnCopy.classList.remove('copied');
              if (span) span.textContent = 'Скопировать название';
            }, 2000);
          }
          if (this.showToast) this.showToast(`Название "${game.title}" скопировано`);
        } catch {
          // ignore clipboard errors
        }
      });
    }

    this.showDrawer();
  }

  /**
   * Opens the drawer in Archetype View mode
   */
  public openArchetype(verdict: MarketVerdict, gamesInArchetype?: NormalizedGame[]): void {
    this.currentMode = 'archetype';
    this.currentVerdict = verdict;
    this.previousVerdict = null;

    const badgeEl = this.drawer.querySelector('#drawer-badge');
    const titleEl = this.drawer.querySelector('#drawer-title');
    const bodyEl = this.drawer.querySelector('#drawer-body');

    const statusBadgeClass =
      verdict.status === 'GREEN_LIGHT'
        ? 'green'
        : verdict.status === 'YELLOW_LIGHT'
        ? 'yellow'
        : 'red';

    const statusBadgeText =
      verdict.status === 'GREEN_LIGHT'
        ? 'Green Light'
        : verdict.status === 'YELLOW_LIGHT'
        ? 'Yellow Light'
        : 'Red Light';

    if (badgeEl) {
      badgeEl.textContent = `${statusBadgeText.toUpperCase()} • ${verdict.archetype}`;
      badgeEl.className = `drawer-tag status-${statusBadgeClass}`;
    }

    if (titleEl) {
      titleEl.textContent = verdict.titleRu;
    }

    if (bodyEl) {
      const score = verdict.opportunityScore.overallScore;
      const viralMultiplier = verdict.opportunityScore.viralMultiplier || 1.0;

      // Parse Core Loop steps
      const loopSteps = (verdict.coreLoopBlueprint || '')
        .split('->')
        .map(s => s.trim())
        .filter(Boolean);

      // Games list
      const games = gamesInArchetype || [];

      bodyEl.innerHTML = `
        <!-- Hero Score Card -->
        <div class="drawer-stat-grid hero-score-grid">
          <div class="drawer-stat-card status-${statusBadgeClass}">
            <div class="stat-card-label">Opportunity Score</div>
            <div class="stat-card-value score-hero-val">${score} <span class="score-max">/100</span></div>
            <div class="drawer-mini-bar">
              <div class="drawer-mini-bar-fill" style="width: ${score}%;"></div>
            </div>
          </div>

          <div class="drawer-stat-card">
            <div class="stat-card-label">Доля рынка & CCU</div>
            <div class="stat-card-value">${verdict.marketSharePercent}%</div>
            <div class="stat-card-sub">${verdict.totalAudienceCCU.toLocaleString()} игроков</div>
          </div>
        </div>

        <!-- Formula Decomposition -->
        <div class="drawer-section">
          <h4 class="drawer-section-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="4" y1="9" x2="20" y2="9"></line>
              <line x1="4" y1="15" x2="20" y2="15"></line>
              <line x1="10" y1="3" x2="8" y2="21"></line>
              <line x1="16" y1="3" x2="14" y2="21"></line>
            </svg>
            Декомпозиция Opportunity Score
          </h4>
          <div class="drawer-formula-grid">
            <div class="drawer-formula-item">
              <span class="factor-name">Спрос (Demand)</span>
              <span class="factor-val">${verdict.opportunityScore.demandScore}</span>
            </div>
            <div class="drawer-formula-item">
              <span class="factor-name">Динамика (Velocity)</span>
              <span class="factor-val">${verdict.opportunityScore.velocityScore}</span>
            </div>
            <div class="drawer-formula-item">
              <span class="factor-name">Монетизация</span>
              <span class="factor-val">${verdict.opportunityScore.monetizationScore}</span>
            </div>
            <div class="drawer-formula-item">
              <span class="factor-name">Насыщенность</span>
              <span class="factor-val">${verdict.opportunityScore.saturationIndex.toFixed(1)}x</span>
            </div>
            <div class="drawer-formula-item">
              <span class="factor-name">Трудоемкость</span>
              <span class="factor-val">${verdict.opportunityScore.productionEffort.toFixed(1)}x</span>
            </div>
            <div class="drawer-formula-item">
              <span class="factor-name">Shorts Множитель</span>
              <span class="factor-val">x${viralMultiplier.toFixed(1)}</span>
            </div>
          </div>
          <div class="drawer-formula-calc">
            (${verdict.opportunityScore.demandScore} × ${verdict.opportunityScore.velocityScore} × ${verdict.opportunityScore.monetizationScore}) / (${verdict.opportunityScore.saturationIndex.toFixed(1)} × ${verdict.opportunityScore.productionEffort.toFixed(1)}) × ${viralMultiplier.toFixed(1)}
          </div>
        </div>

        <!-- Extended Core Loop Blueprint -->
        <div class="drawer-section">
          <h4 class="drawer-section-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            Расширенный Core Loop
          </h4>
          <div class="drawer-loop-chain">
            ${loopSteps
              .map(
                (step, idx) => `
              <div class="drawer-loop-node">
                <span class="loop-node-index">${idx + 1}</span>
                <span class="loop-node-text">${this.escapeHtml(step)}</span>
              </div>
              ${
                idx < loopSteps.length - 1
                  ? `<div class="drawer-loop-connector">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <polyline points="19 12 12 19 5 12"></polyline>
                      </svg>
                    </div>`
                  : ''
              }
            `
              )
              .join('')}
          </div>
        </div>

        <!-- Games in Archetype from Snapshot -->
        <div class="drawer-section">
          <div class="drawer-section-header">
            <h4 class="drawer-section-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="6 2 18 2 18 6 6 6 6 2"></polygon>
                <rect x="3" y="6" width="18" height="16" rx="2"></rect>
              </svg>
              Игры архетипа в снимке (${games.length})
            </h4>
            <span class="drawer-section-sub">Кликните по игре для подробностей</span>
          </div>

          <div class="drawer-games-stack">
            ${
              games.length > 0
                ? games
                    .map(g => {
                      const pMeta = this.getPlatformMeta(g.platform);
                      const lRatio =
                        typeof g.likeRatio === 'number'
                          ? Math.round(g.likeRatio > 1 ? g.likeRatio : g.likeRatio * 100)
                          : null;
                      return `
                  <button type="button" class="drawer-game-row" data-game-id="${g.id}">
                    <div class="game-row-left">
                      <span class="drawer-platform-dot ${pMeta.badgeClass}"></span>
                      <div class="game-row-meta">
                        <span class="game-row-title">${this.escapeHtml(g.title)}</span>
                        <span class="game-row-stats">
                          ${pMeta.label} • ${g.metricValue.toLocaleString()} ${g.metricType === 'ccu' ? 'CCU' : 'очков'}
                          ${lRatio ? ` • 👍 ${lRatio}%` : ''}
                        </span>
                      </div>
                    </div>
                    <svg class="game-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                `;
                    })
                    .join('')
                : `
                <div class="drawer-empty-games">
                  <span>В снимке нет прямых игр с этим архетипом</span>
                </div>
              `
            }
          </div>
        </div>

        <!-- Monetization Strategy -->
        <div class="drawer-section">
          <h4 class="drawer-section-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            Стратегия монетизации
          </h4>
          <p class="drawer-section-text">${this.escapeHtml(verdict.monetizationStrategy)}</p>
        </div>

        <!-- Risks and Pitfalls -->
        <div class="drawer-section drawer-risk-alert">
          <h4 class="drawer-section-title" style="color: #fb7185;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Чего избегать (Риски и грабли)
          </h4>
          <p class="drawer-section-text">${this.escapeHtml(verdict.avoidPitfalls)}</p>
        </div>

        <!-- Recommendation -->
        <div class="drawer-section drawer-action-box">
          <h4 class="drawer-section-title" style="color: var(--accent-cyan);">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            Рекомендация по действию
          </h4>
          <p class="drawer-section-text">${this.escapeHtml(verdict.actionRecommendation)}</p>
        </div>

        <!-- Footer Actions -->
        <div class="drawer-footer-actions">
          <button type="button" class="drawer-btn primary" id="drawer-btn-filter-archetype">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>Фильтровать каталог по архетипу</span>
          </button>

          <button type="button" class="drawer-btn secondary" id="drawer-btn-copy-archetype">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Скопировать название</span>
          </button>
        </div>
      `;

      // Game row clicks to open game view in drawer
      const gameRows = bodyEl.querySelectorAll<HTMLButtonElement>('.drawer-game-row');
      gameRows.forEach(row => {
        row.addEventListener('click', () => {
          const gameId = row.getAttribute('data-game-id');
          const targetGame = games.find(g => g.id === gameId);
          if (targetGame) {
            this.openGame(targetGame, games, verdict);
          }
        });
      });

      // Filter catalogue
      const btnFilter = bodyEl.querySelector('#drawer-btn-filter-archetype');
      btnFilter?.addEventListener('click', () => {
        if (this.onFilterSearch) {
          this.onFilterSearch('', verdict.archetype);
        }
        this.close();
        const container = document.getElementById('verdicts-container');
        container?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      // Copy name
      const btnCopy = bodyEl.querySelector('#drawer-btn-copy-archetype');
      btnCopy?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(verdict.titleRu);
          if (btnCopy) {
            btnCopy.classList.add('copied');
            const span = btnCopy.querySelector('span');
            if (span) span.textContent = 'Скопировано!';
            setTimeout(() => {
              btnCopy.classList.remove('copied');
              if (span) span.textContent = 'Скопировать название';
            }, 2000);
          }
          if (this.showToast) this.showToast(`Архетип "${verdict.titleRu}" скопирован`);
        } catch {
          // ignore
        }
      });
    }

    this.showDrawer();
  }

  /**
   * Opens the drawer with a TickerSignal for backward compatibility with LiveTicker
   */
  public openSignal(signal: TickerSignal): void {
    this.currentMode = 'signal';
    this.currentSignal = signal;
    this.previousVerdict = null;

    const badgeEl = this.drawer.querySelector('#drawer-badge');
    const titleEl = this.drawer.querySelector('#drawer-title');
    const bodyEl = this.drawer.querySelector('#drawer-body');

    if (badgeEl) {
      badgeEl.textContent = `${signal.emoji || '⚡'} ${signal.details.categoryRu.toUpperCase()}`;
      badgeEl.className = `drawer-tag ${signal.badgeClass}`;
    }

    if (titleEl) {
      titleEl.textContent = signal.title;
    }

    if (bodyEl) {
      const tagsHtml = (signal.details.tags || [])
        .slice(0, 8)
        .map(t => `<span class="drawer-chip clickable-chip" data-tag="${this.escapeHtml(t)}">${this.escapeHtml(t)}</span>`)
        .join('');

      bodyEl.innerHTML = `
        <div class="drawer-stat-card ${signal.badgeClass}">
          <div class="stat-card-label">${this.escapeHtml(signal.details.metricLabel)}</div>
          <div class="stat-card-value">${this.escapeHtml(signal.details.metricValue)}</div>
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
          <p class="drawer-section-text">${this.escapeHtml(signal.details.description)}</p>
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
            <p class="drawer-section-text">${this.escapeHtml(signal.details.actionRu)}</p>
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

      // Filter button
      const btnFilter = bodyEl.querySelector('#drawer-btn-filter-signal');
      btnFilter?.addEventListener('click', () => {
        if (this.onFilterSearch) {
          this.onFilterSearch(signal.searchFilter, signal.archetype);
        }
        this.close();
        const verdictsEl = document.getElementById('verdicts-container');
        verdictsEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      // Copy button
      const btnCopy = bodyEl.querySelector('#drawer-btn-copy-signal');
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
          if (this.showToast) this.showToast(`Название "${signal.title}" скопировано`);
        } catch {
          // ignore
        }
      });
    }

    this.showDrawer();
  }

  private showDrawer(): void {
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

  public isOpen(): boolean {
    return this.drawer.classList.contains('active');
  }

  private getPlatformMeta(platform: PlatformType): {
    label: string;
    badgeClass: string;
    iconSvg: string;
  } {
    switch (platform) {
      case 'roblox':
        return {
          label: 'Roblox',
          badgeClass: 'badge-roblox',
          iconSvg: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M5.33 2.5L2.5 18.67l16.17 2.83 2.83-16.17L5.33 2.5zm8.5 10.33l-3.66-.64.64-3.67 3.67.64-.65 3.67z"/></svg>`,
        };
      case 'yandex_games':
        return {
          label: 'Yandex Games',
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
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
