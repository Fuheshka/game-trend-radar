/**
 * Вкладка «Арбитраж»: матрица ниш Roblox → Яндекс Игры, монтируется при первом открытии.
 * Над матрицей — новые и исчезнувшие ниши относительно базы сравнения.
 */
import { ArbitrageMatrixComponent } from '../../components/ArbitrageMatrix.js';
import { soundService } from '../../services/sound.js';
import { ArbitrageOpportunity } from '../../types.js';
import { escapeHtml } from '../../utils/dom.js';
import { cleanDisplayTitle, formatSnapshotDateRu } from '../../utils/format.js';
import { diffArbitrageNiches } from '../../utils/snapshotDiff.js';
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
    this.renderCompare();
  }

  update(): void {
    this.arbitrageMatrix?.updateData(this.deps.state.snapshot.arbitrageOpportunities || []);
    this.updateCountUI();
    if (this.arbitrageMatrix) this.renderCompare();
  }

  /** «vs 15 окт · Новых ниш: 2 · Исчезло: 1» с названиями; без базы блок скрыт. */
  private renderCompare(): void {
    const el = document.getElementById('arbitrage-compare');
    const { snapshot, baseSnapshot } = this.deps.state;
    if (!el) return;
    el.hidden = !baseSnapshot;
    if (!baseSnapshot) return;
    const { added, removed } = diffArbitrageNiches(snapshot, baseSnapshot);
    const names = (list: ArbitrageOpportunity[]) =>
      list.map(o => escapeHtml(cleanDisplayTitle(o.robloxGame.title))).join(', ');
    el.innerHTML = `
      <span class="arbitrage-compare-base">vs ${escapeHtml(formatSnapshotDateRu(baseSnapshot.timestamp))}</span>
      <span class="arbitrage-compare-item delta-up" data-role="niches-added" title="${names(added)}">Новых ниш: ${added.length}</span>
      <span class="arbitrage-compare-item delta-down" data-role="niches-removed" title="${names(removed)}">Исчезло: ${removed.length}</span>
      ${added.length ? `<span class="arbitrage-compare-names">Новые: ${names(added)}</span>` : ''}
      ${removed.length ? `<span class="arbitrage-compare-names">Исчезли: ${names(removed)}</span>` : ''}`;
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
