import { MarketSnapshot, NormalizedGame, GameArchetype } from '../types.js';
import {
  BreakoutItem,
  GainerItem,
  GainersSortMode,
  MoversViewOptions,
  ViralSignalItem,
} from './movers/types.js';
import {
  breakoutsFromNewEntries,
  calculate24hGainers,
  filterBreakoutNewReleases,
  filterViralSignals,
  gainersFromRisers,
} from './movers/data.js';
import { renderMoversMarkup } from './movers/sections.js';

export type {
  GainersSortMode,
  SparklineData,
  GainerItem,
  ViralSignalItem,
  BreakoutItem,
  MoversViewOptions,
} from './movers/types.js';
export { ARCHETYPE_RU_MAP, PLATFORM_NAMES, ICONS } from './movers/constants.js';
export { cleanDisplayTitle, formatCCU } from './movers/format.js';
export { generateMoversSparkline } from './movers/sparkline.js';
export {
  calculate24hGainers,
  filterViralSignals,
  filterBreakoutNewReleases,
  gainersFromRisers,
  breakoutsFromNewEntries,
} from './movers/data.js';

/**
 * MoversViewComponent — экран лидеров роста и опережающих индикаторов
 * (DefiLlama Movers & Shakers стиль)
 */
export class MoversViewComponent {
  private container: HTMLElement;
  private currentSnapshot: MarketSnapshot | null = null;
  private previousSnapshot: MarketSnapshot | null = null;
  private gainersSort: GainersSortMode = 'abs';

  private onSelectGame?: (game: NormalizedGame) => void;
  private onSelectArchetype?: (archetype: GameArchetype) => void;
  private onTagClick?: (tag: string) => void;

  private gainers: GainerItem[] = [];
  private viralSignals: ViralSignalItem[] = [];
  private breakouts: BreakoutItem[] = [];

  private boundClickHandler: (e: MouseEvent) => void;

  constructor(options: MoversViewOptions) {
    this.container = options.container;
    this.currentSnapshot = options.currentSnapshot || null;
    this.previousSnapshot = options.previousSnapshot || null;
    this.gainersSort = options.initialGainersSort || 'abs';
    this.onSelectGame = options.onSelectGame;
    this.onSelectArchetype = options.onSelectArchetype;
    this.onTagClick = options.onTagClick;

    this.boundClickHandler = this.handleClick.bind(this);
    this.container.addEventListener('click', this.boundClickHandler);

    this.recalculate();
    this.render();
  }

  public getGainers(): GainerItem[] {
    return this.gainers;
  }

  public getViralSignals(): ViralSignalItem[] {
    return this.viralSignals;
  }

  public getBreakouts(): BreakoutItem[] {
    return this.breakouts;
  }

  public getGainersSort(): GainersSortMode {
    return this.gainersSort;
  }

  public setGainersSort(mode: GainersSortMode): void {
    if (this.gainersSort === mode) return;
    this.gainersSort = mode;
    this.gainers = calculate24hGainers(this.currentSnapshot, this.previousSnapshot, this.gainersSort);
    this.render();
  }

  public updateData(currentSnapshot: MarketSnapshot, previousSnapshot?: MarketSnapshot | null): void {
    this.currentSnapshot = currentSnapshot;
    this.previousSnapshot = previousSnapshot ?? null;
    this.recalculate();
    this.render();
  }

  public destroy(): void {
    this.container.removeEventListener('click', this.boundClickHandler);
    this.container.innerHTML = '';
  }

  private recalculate(): void {
    this.gainers =
      gainersFromRisers(this.currentSnapshot, this.gainersSort) ??
      calculate24hGainers(this.currentSnapshot, this.previousSnapshot, this.gainersSort);
    this.viralSignals = filterViralSignals(this.currentSnapshot, 1.5);
    this.breakouts = breakoutsFromNewEntries(this.currentSnapshot) ?? filterBreakoutNewReleases(this.currentSnapshot, 14);
  }

  /** Есть ли в снимке настоящая история по играм (новые снимки) — тогда окно 7 дней, а не сравнение с прошлым срезом. */
  private hasHistory(): boolean {
    return !!this.currentSnapshot?.risers;
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target) return;

    // 1. Переключение сортировки 24h Gainers
    const sortBtn =
      target.closest<HTMLElement>('.gainers-sort-toggle') ||
      target.closest<HTMLElement>('[data-sort-mode]');
    if (sortBtn) {
      const mode = sortBtn.getAttribute('data-sort-mode') as GainersSortMode;
      if (mode === 'abs' || mode === 'pct') {
        this.setGainersSort(mode);
        return;
      }
    }

    // 2. Клик по кнопке инспектора
    const inspectBtn =
      target.closest<HTMLElement>('.btn-inspect') ||
      target.closest<HTMLElement>('.card-inspect-btn') ||
      target.closest<HTMLElement>('button[data-action="inspect"]');
    if (inspectBtn) {
      e.stopPropagation();
      const gameId = inspectBtn.getAttribute('data-game-id');
      const archetype = inspectBtn.getAttribute('data-archetype') as GameArchetype | null;

      if (gameId && this.currentSnapshot?.games) {
        const found = this.currentSnapshot.games.find(g => g.id === gameId);
        if (found) {
          this.onSelectGame?.(found);
          return;
        }
      }

      if (archetype) {
        this.onSelectArchetype?.(archetype);
        return;
      }
    }

    // 3. Клик по тегу архетипа
    const archetypeTag =
      target.closest<HTMLElement>('.archetype-tag') ||
      target.closest<HTMLElement>('.badge-archetype') ||
      target.closest<HTMLElement>('[data-archetype]');
    if (archetypeTag) {
      const archetype = archetypeTag.getAttribute('data-archetype') as GameArchetype | null;
      if (archetype) {
        this.onSelectArchetype?.(archetype);
        return;
      }
    }

    // 4. Клик по карточке целиком (если не кнопка)
    const card =
      target.closest<HTMLElement>('.movers-card') ||
      target.closest<HTMLElement>('[data-card="mover"]');
    if (card) {
      const gameId = card.getAttribute('data-id');
      if (gameId && this.currentSnapshot?.games) {
        const found = this.currentSnapshot.games.find(g => g.id === gameId);
        if (found) {
          this.onSelectGame?.(found);
          return;
        }
      }
      const archetype = card.getAttribute('data-archetype') as GameArchetype | null;
      if (archetype) {
        this.onSelectArchetype?.(archetype);
        return;
      }
    }
  }

  private render(): void {
    this.container.innerHTML = renderMoversMarkup({
      gainers: this.gainers,
      viralSignals: this.viralSignals,
      breakouts: this.breakouts,
      gainersSort: this.gainersSort,
      hasHistory: this.hasHistory(),
    });
  }
}

export const MoversView = MoversViewComponent;
