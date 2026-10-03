/**
 * WorkspaceTabs — сегментированный переключатель рабочих пространств.
 *
 * Управляет 4 изолированными экранами:
 *   1 -> #view-radar    (Обзор и Радар)
 *   2 -> #view-movers   (Лидеры роста)
 *   3 -> #view-catalog  (Каталог игр)
 *   4 -> #view-arbitrage (Матрица арбитража)
 *
 * Горячие клавиши: 1, 2, 3, 4 — переключение таба.
 * Esc — закрывает открытый drawer (делегируется наружу через onEscape).
 */

export type WorkspaceId = 'radar' | 'movers' | 'catalog' | 'arbitrage';

export interface WorkspaceTabsOptions {
  /** Вызывается при смене активной вкладки */
  onSwitch: (workspace: WorkspaceId) => void;
  /** Вызывается при нажатии Esc (для закрытия drawer) */
  onEscape?: () => void;
  /** Начальная вкладка */
  initial?: WorkspaceId;
}

const TABS: { id: WorkspaceId; key: string }[] = [
  { id: 'radar',     key: '1' },
  { id: 'movers',    key: '2' },
  { id: 'catalog',   key: '3' },
  { id: 'arbitrage', key: '4' },
];

const VIEW_PANELS: Record<WorkspaceId, string> = {
  radar:     'view-radar',
  movers:    'view-movers',
  catalog:   'view-catalog',
  arbitrage: 'view-arbitrage',
};

const TAB_BUTTONS: Record<WorkspaceId, string> = {
  radar:     'tab-btn-radar',
  movers:    'tab-btn-movers',
  catalog:   'tab-btn-catalog',
  arbitrage: 'tab-btn-arbitrage',
};

export class WorkspaceTabsComponent {
  private current: WorkspaceId;
  private readonly onSwitch: (w: WorkspaceId) => void;
  private readonly onEscape?: () => void;
  private scrollPositions: Map<WorkspaceId, number> = new Map();
  private boundKeydown: (e: KeyboardEvent) => void;

  constructor(options: WorkspaceTabsOptions) {
    this.current = options.initial ?? 'radar';
    this.onSwitch = options.onSwitch;
    this.onEscape = options.onEscape;

    // Wire up tab button click listeners
    for (const tab of TABS) {
      const btn = document.getElementById(TAB_BUTTONS[tab.id]);
      btn?.addEventListener('click', () => this.switchTo(tab.id));
    }

    // Keyboard shortcuts
    this.boundKeydown = this.handleKeydown.bind(this);
    window.addEventListener('keydown', this.boundKeydown);

    // Apply initial state without animation
    this.applyView(this.current, false);
  }

  private handleKeydown(e: KeyboardEvent): void {
    // Ignore when user is typing in an input/textarea/select
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === 'Escape') {
      this.onEscape?.();
      return;
    }

    const tab = TABS.find(t => t.key === e.key);
    if (tab && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      this.switchTo(tab.id);
    }
  }

  public switchTo(workspace: WorkspaceId): void {
    if (this.current === workspace) return;

    // Save current scroll position before leaving (checking window.scrollY and panel.scrollTop)
    const currentPanel = document.getElementById(VIEW_PANELS[this.current]);
    const scrollPos = (typeof window !== 'undefined' && window.scrollY > 0)
      ? window.scrollY
      : (currentPanel?.scrollTop ?? 0);
    this.scrollPositions.set(this.current, scrollPos);

    this.current = workspace;
    this.applyView(workspace, true);
    this.onSwitch(workspace);
  }

  public getCurrent(): WorkspaceId {
    return this.current;
  }

  private applyView(workspace: WorkspaceId, restoreScroll: boolean): void {
    for (const tab of TABS) {
      const btn = document.getElementById(TAB_BUTTONS[tab.id]);
      const panel = document.getElementById(VIEW_PANELS[tab.id]);

      const isActive = tab.id === workspace;
      btn?.classList.toggle('active', isActive);

      if (panel) {
        panel.style.display = isActive ? 'block' : 'none';

        if (isActive && restoreScroll) {
          const saved = this.scrollPositions.get(tab.id) ?? 0;
          const restore = () => {
            if (panel.scrollTop !== undefined && panel.scrollHeight > panel.clientHeight) {
              panel.scrollTop = saved;
            }
            if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
              window.scrollTo({ top: saved, behavior: 'instant' });
            }
          };

          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(restore);
          } else {
            restore();
          }
        }
      }
    }
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.boundKeydown);
  }
}
