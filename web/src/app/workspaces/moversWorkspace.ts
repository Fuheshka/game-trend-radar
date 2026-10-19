/**
 * Вкладка «Лидеры роста» (DefiLlama Movers & Shakers): монтируется при первом открытии,
 * сравнивает текущий снимок с предыдущим срезом истории.
 */
import { MoversViewComponent } from '../../components/MoversView.js';
import type { AppState } from '../state.js';
import type { Workspace, WorkspaceDrawer } from './workspace.js';

export interface MoversWorkspaceDeps {
  state: AppState;
  drawer: WorkspaceDrawer;
}

export class MoversWorkspace implements Workspace {
  private moversView?: MoversViewComponent;

  constructor(private readonly deps: MoversWorkspaceDeps) {}

  show(): void {
    const moversContainer = document.getElementById('view-movers');
    if (this.moversView || !moversContainer) return;
    const { state, drawer } = this.deps;
    this.moversView = new MoversViewComponent({
      container: moversContainer,
      currentSnapshot: state.snapshot,
      previousSnapshot: state.previousSnapshot,
      onSelectGame: game => {
        drawer.openGameFromList(game);
      },
      onSelectArchetype: archetype => {
        drawer.openArchetypeFromMovers(archetype);
      },
    });
  }

  update(): void {
    this.moversView?.updateData(this.deps.state.snapshot, this.deps.state.previousSnapshot);
  }
}
