/**
 * Боковой drawer (игра / архетип / сигнал тикера) и модалка генератора ТЗ для ИИ.
 * Кнопка «Сгенерировать ТЗ для ИИ» вставляется в подвал drawer'а архетипа отсюда, а не компонентом.
 */
import { GameArchetype, NormalizedGame } from '../types.js';
import { DetailDrawerComponent } from '../components/DetailDrawer.js';
import { PromptGeneratorModalComponent } from '../components/PromptGeneratorModal.js';
import type { TickerSignal } from '../components/LiveTicker.js';
import { soundService } from '../services/sound.js';
import type { AppState } from './state.js';
import { resolveGame, getGamesForArchetype } from './gameLookup.js';
import { showToast } from './ui.js';
import { fetchGameHistory } from '../services/snapshotApi.js';

export type DrawerView = Pick<DetailDrawerComponent, 'openGame' | 'openArchetype' | 'openSignal' | 'close'>;
export type PromptModalView = Pick<PromptGeneratorModalComponent, 'open'>;

export interface DrawerControllerDeps {
  state: AppState;
  /** «Показать на радаре» из drawer'а и клик по сигналу тикера — фильтр вкладки «Радар». */
  onFilterSearch: (query: string, archetype?: GameArchetype) => void;
}

export class DrawerController {
  private readonly state: AppState;
  private readonly onFilterSearch: DrawerControllerDeps['onFilterSearch'];
  private detailDrawer!: DrawerView;
  private promptModal!: PromptModalView;
  private drawerEl: HTMLElement | null = null;

  constructor(deps: DrawerControllerDeps) {
    this.state = deps.state;
    this.onFilterSearch = deps.onFilterSearch;
  }

  /**
   * Делегирование клика по кнопке ТЗ и её возврат после перерисовки drawer'а.
   * Архетип кнопки берётся из открытого drawer'а (`data-archetype` кнопки фильтра): drawer архетипа
   * открывают и в обход контроллера — вкладка «Лидеры», «← к архетипу» внутри drawer'а.
   */
  bindDrawerEvents(gameDrawerEl: HTMLElement | null = document.getElementById('game-drawer')): void {
    this.drawerEl = gameDrawerEl;
    gameDrawerEl?.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      const specBtn = target.closest('#drawer-btn-generate-spec');
      if (specBtn) {
        e.stopPropagation();
        const archetype = this.shownArchetype();
        if (archetype) {
          this.openPromptModalForArchetype(archetype);
        }
      }
    });

    if (gameDrawerEl) {
      const observer = new MutationObserver(() => {
        if (this.shownArchetype()) {
          this.injectDrawerPromptButton();
        }
      });
      observer.observe(gameDrawerEl, { childList: true, subtree: true });
    }
  }

  mountDrawer(view?: DrawerView): void {
    if (view) {
      this.detailDrawer = view;
      return;
    }
    const drawerBackdrop = document.getElementById('drawer-backdrop');
    const gameDrawer = document.getElementById('game-drawer');
    if (drawerBackdrop && gameDrawer) {
      this.detailDrawer = new DetailDrawerComponent({
        backdrop: drawerBackdrop,
        drawer: gameDrawer,
        onFilterSearch: (query, archetype) => {
          this.onFilterSearch(query, archetype);
        },
        showToast: msg => showToast(msg),
        onSelectGame: game => {
          this.openGameDetail(game.title, game.archetype);
        },
        onSelectArchetype: archetype => {
          this.openArchetypeDetail(archetype);
        },
        loadHistory: id => (this.state.apiAvailable ? fetchGameHistory(id) : null),
      });
    }
  }

  mountPromptModal(modal?: PromptModalView): void {
    this.promptModal =
      modal ??
      new PromptGeneratorModalComponent({
        showToast: msg => showToast(msg),
        onClose: () => soundService.playClick(),
      });
  }

  /** Esc: закрывает drawer, если он открыт. */
  closeIfOpen(): boolean {
    const drawer = document.getElementById('game-drawer');
    if (drawer && drawer.getAttribute('aria-hidden') === 'false') {
      this.detailDrawer?.close?.();
      return true;
    }
    return false;
  }

  openArchetypeDetail(archetype: GameArchetype): void {
    const verdict = (this.state.snapshot.verdicts || []).find(v => v.archetype === archetype);
    if (!verdict) return;

    soundService.playRadarPing();
    const games = getGamesForArchetype(this.state.snapshot, archetype);
    this.detailDrawer.openArchetype(verdict, games);
    this.injectDrawerPromptButton();
  }

  openGameDetail(titleOrId: string, archetypeHint?: GameArchetype): void {
    if (!titleOrId) return;
    soundService.playClick();

    const snapshot = this.state.snapshot;
    const found = resolveGame(snapshot, titleOrId, archetypeHint);
    const archetypeGames = getGamesForArchetype(snapshot, found.archetype);
    const parentVerdict = (snapshot.verdicts || []).find(v => v.archetype === found.archetype);

    this.detailDrawer.openGame(found, archetypeGames, parentVerdict);
  }

  /** Строка каталога, карточка арбитража или лидеров: drawer игры на фоне всех игр снимка. */
  openGameFromList(game: NormalizedGame): void {
    soundService.playClick();
    this.detailDrawer.openGame(game, this.state.snapshot.games);
  }

  /** Тег архетипа на вкладке «Лидеры роста». */
  openArchetypeFromMovers(archetype: GameArchetype): void {
    soundService.playClick();
    const verdict = this.state.snapshot.verdicts.find(v => v.archetype === archetype);
    if (verdict) {
      this.detailDrawer.openArchetype(verdict, this.state.snapshot.games);
    }
  }

  handleTickerSignalClick(signal: TickerSignal): void {
    if (signal.archetype) {
      soundService.playRadarPing();
    } else {
      soundService.playClick();
    }
    if (this.detailDrawer) {
      this.detailDrawer.openSignal(signal);
    }
    this.onFilterSearch(signal.searchFilter, signal.archetype);
  }

  openPromptModalForArchetype(archetype: GameArchetype): void {
    const snapshot = this.state.snapshot;
    const verdict = (snapshot.verdicts || []).find(v => v.archetype === archetype);
    const games = getGamesForArchetype(snapshot, archetype);
    const arbitrage = (snapshot.arbitrageOpportunities || []).find(
      o => o.archetype === archetype
    );
    soundService.playClick();
    this.promptModal.open(verdict, games, arbitrage);
  }

  /** Архетип, открытый в drawer'е сейчас; null — drawer показывает игру или сигнал. */
  private shownArchetype(): GameArchetype | null {
    const filterBtn = this.drawerEl?.querySelector('#drawer-btn-filter-archetype');
    return (filterBtn?.getAttribute('data-archetype') as GameArchetype | null | undefined) || null;
  }

  private injectDrawerPromptButton(): void {
    const footerActions = this.drawerEl?.querySelector<HTMLElement>('.drawer-footer-actions');
    if (footerActions && !footerActions.querySelector('#drawer-btn-generate-spec')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'drawer-btn ai-spec-btn';
      btn.id = 'drawer-btn-generate-spec';
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        <span>Сгенерировать ТЗ для ИИ</span>
      `;
      footerActions.insertBefore(btn, footerActions.firstChild);
    }
  }
}
