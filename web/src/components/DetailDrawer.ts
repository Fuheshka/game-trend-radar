import { NormalizedGame, MarketVerdict, GameArchetype, GameHistoryResponse } from '../types.js';
import { TickerSignal } from './LiveTicker.js';
import { getPlatformMeta } from '../utils/labels.js';
import { buildGameBodyHtml } from './detailDrawer/gameView.js';
import { buildArchetypeBodyHtml } from './detailDrawer/archetypeView.js';
import { buildSignalBodyHtml } from './detailDrawer/signalView.js';
import { buildHistoryChartHtml, buildHistoryPlaceholderHtml } from './detailDrawer/historyChart.js';

export interface DetailDrawerOptions {
  backdrop: HTMLElement;
  drawer: HTMLElement;
  onFilterSearch?: (query: string, archetype?: GameArchetype) => void;
  showToast?: (message: string) => void;
  onSelectGame?: (game: NormalizedGame) => void;
  onSelectArchetype?: (archetype: GameArchetype) => void;
  /** История игры по дням; вернуть null (не промис) — API нет (статика), показываем подсказку. */
  loadHistory?: (gameId: string) => Promise<GameHistoryResponse | null> | null;
}

export type DrawerMode = 'game' | 'archetype' | 'signal';

export class DetailDrawerComponent {
  private backdrop: HTMLElement;
  private drawer: HTMLElement;
  private onFilterSearch?: (query: string, archetype?: GameArchetype) => void;
  private showToast?: (message: string) => void;
  private onSelectGame?: (game: NormalizedGame) => void;
  private onSelectArchetype?: (archetype: GameArchetype) => void;
  private loadHistory?: DetailDrawerOptions['loadHistory'];

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
    this.loadHistory = options.loadHistory;

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

  /** Блок истории: подсказка без API, иначе загрузка и график, если drawer всё ещё на этой игре. */
  private renderHistory(bodyEl: Element, game: NormalizedGame): void {
    const el = bodyEl.querySelector<HTMLElement>('#drawer-history');
    if (!el || !this.loadHistory) return;
    const pending = this.loadHistory(game.id);
    el.hidden = false;
    if (!pending) {
      el.innerHTML = buildHistoryPlaceholderHtml('no-api');
      return;
    }
    el.innerHTML = buildHistoryPlaceholderHtml('loading');
    void pending.then(history => {
      if (this.currentGame !== game || !el.isConnected) return;
      el.innerHTML = history ? buildHistoryChartHtml(history) : buildHistoryPlaceholderHtml('empty');
    });
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

    const platformMeta = getPlatformMeta(game.platform);

    if (badgeEl) {
      badgeEl.textContent = `${platformMeta.label.toUpperCase()}`;
      badgeEl.className = `drawer-tag ${platformMeta.badgeClass}`;
    }

    if (titleEl) {
      titleEl.textContent = game.title;
    }

    if (bodyEl) {
      bodyEl.innerHTML = buildGameBodyHtml(game, this.previousVerdict, platformMeta);

      this.renderHistory(bodyEl, game);

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
      // Games list
      const games = gamesInArchetype || [];


      bodyEl.innerHTML = buildArchetypeBodyHtml(verdict, games, statusBadgeClass);

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
      bodyEl.innerHTML = buildSignalBodyHtml(signal);

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
}
