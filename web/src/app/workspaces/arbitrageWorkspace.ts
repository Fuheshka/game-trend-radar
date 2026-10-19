/**
 * Вкладка «Арбитраж»: матрица ниш Roblox → Яндекс Игры, монтируется при первом открытии.
 */
import { ArbitrageMatrixComponent } from '../../components/ArbitrageMatrix.js';
import { soundService } from '../../services/sound.js';
import type { AppState } from '../state.js';
import type { Workspace, WorkspaceDrawer } from './workspace.js';

export interface ArbitrageWorkspaceDeps {
  state: AppState;
  drawer: Pick<WorkspaceDrawer, 'openGameFromList'>;
}

export class ArbitrageWorkspace implements Workspace {
  private arbitrageMatrix?: ArbitrageMatrixComponent;

  constructor(private readonly deps: ArbitrageWorkspaceDeps) {}

  show(): void {
    this.mount();
    this.updateCountUI();
  }

  private mount(): void {
    const arbitrageContainer = document.getElementById('arbitrage-matrix-container');
    if (this.arbitrageMatrix || !arbitrageContainer) return;
    this.arbitrageMatrix = new ArbitrageMatrixComponent({
      container: arbitrageContainer,
      opportunities: this.deps.state.snapshot.arbitrageOpportunities || [],
      onSelectGame: game => {
        this.deps.drawer.openGameFromList(game);
      },
      onOpenRoblox: url => {
        soundService.playClick();
        window.open(url, '_blank', 'noopener,noreferrer');
      },
    });
    this.updateCountUI();
  }

  update(): void {
    this.arbitrageMatrix?.updateData(this.deps.state.snapshot.arbitrageOpportunities || []);
    this.updateCountUI();
  }

  /** Бейдж вкладки: до монтирования — по снимку. */
  updateCountUI(): void {
    const tabBadge = document.getElementById('tab-arbitrage-count');
    if (tabBadge) {
      const count = this.arbitrageMatrix
        ? this.arbitrageMatrix.getTotalCount()
        : (this.deps.state.snapshot.arbitrageOpportunities?.length ?? 0);
      tabBadge.textContent = count.toString();
    }
  }
}
