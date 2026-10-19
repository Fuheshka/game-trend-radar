/**
 * Точка входа дашборда: только сборка. Общее состояние — `AppState` (app/state.ts);
 * логика — в контроллерах `app/*Controller.ts` и вкладках `app/workspaces/*`.
 */
import { LiveTickerComponent } from './components/LiveTicker.js';
import { WorkspaceTabsComponent, WorkspaceId } from './components/WorkspaceTabs.js';
import { HeaderStatusBarComponent } from './components/HeaderStatusBar.js';
import { soundService } from './services/sound.js';
import { liveEventService } from './services/liveEventService.js';
import {
  exportSnapshotToMarkdown,
  exportSnapshotToJson,
  generateExportFilename,
  downloadBlob,
} from './services/exporter.js';
import { POPULAR_SEARCH_TAGS, PopularSearchTag } from './app/search.js';
import { AppState, createAppState } from './app/state.js';
import { updateSoundUI } from './app/ui.js';
import { SnapshotController } from './app/snapshotController.js';
import { ScanController } from './app/scanController.js';
import { MetricsController } from './app/metricsController.js';
import { DrawerController } from './app/drawerController.js';
import type { Workspace } from './app/workspaces/workspace.js';
import { RadarWorkspace } from './app/workspaces/radarWorkspace.js';
import { CatalogWorkspace, CATALOG_SORTS } from './app/workspaces/catalogWorkspace.js';
import { ArbitrageWorkspace } from './app/workspaces/arbitrageWorkspace.js';
import { MoversWorkspace } from './app/workspaces/moversWorkspace.js';
import { VERDICT_SORTS, STATUS_FILTERS, PLATFORM_FILTERS } from './app/verdictFilters.js';
import { formatSnapshotDateRu } from './utils/format.js';

// Значения из разметки index.html сверяются с этими списками в tests/MarkupContract.test.ts
export { POPULAR_SEARCH_TAGS, formatSnapshotDateRu, VERDICT_SORTS, STATUS_FILTERS, PLATFORM_FILTERS, CATALOG_SORTS };
export type { PopularSearchTag };

class App {
  private readonly state: AppState = createAppState();
  private readonly drawer = new DrawerController({
    state: this.state,
    onFilterSearch: (query, archetype) => this.radar.applyFilterFromSignal(query, archetype),
  });
  private readonly radar = new RadarWorkspace({ state: this.state, drawer: this.drawer });
  private readonly catalog = new CatalogWorkspace({ state: this.state, drawer: this.drawer });
  private readonly arbitrage = new ArbitrageWorkspace({ state: this.state, drawer: this.drawer });
  private readonly movers = new MoversWorkspace({ state: this.state, drawer: this.drawer });
  private readonly workspaces: Record<WorkspaceId, Workspace> = {
    radar: this.radar,
    movers: this.movers,
    catalog: this.catalog,
    arbitrage: this.arbitrage,
  };

  private workspaceTabs!: WorkspaceTabsComponent;
  private headerStatusBar!: HeaderStatusBarComponent;
  private liveTicker?: LiveTickerComponent;
  private snapshots!: SnapshotController;
  private scan!: ScanController;
  private metrics!: MetricsController;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.bindControls();
    this.initWorkspaceTabs();
    this.initShortcuts();

    // Initial render with fallback data while fetching live snapshot
    this.setupComponents();
    this.radar.renderInitial();
    this.metrics.update();

    // Подписки на SSE; подключается fetchSnapshots, когда API доступен
    this.scan.subscribe();
    setInterval(() => this.metrics.refreshFreshness(), 60_000);

    // Fetch live snapshots list & data from backend
    await this.snapshots.fetchSnapshots();
  }

  private bindControls(): void {
    // Sound toggle initial state
    updateSoundUI(soundService.isMuted());

    this.radar.bindControls();

    // Global Metric Card: Arbitrage shortcut click
    const metricArbitrageCard = document.querySelector('.metric-card.orange');
    metricArbitrageCard?.addEventListener('click', () => {
      this.workspaceTabs?.switchTo('arbitrage');
      soundService.playClick();
    });

    this.catalog.bindToolbar();
  }

  private initWorkspaceTabs(): void {
    this.workspaceTabs = new WorkspaceTabsComponent({
      initial: 'radar',
      onSwitch: (workspace: WorkspaceId) => {
        this.state.currentView = workspace;
        soundService.playClick();
        this.workspaces[workspace].show();
      },
      onEscape: () => {
        // Close drawer if open, otherwise clear search
        if (this.drawer.closeIfOpen()) return;
        this.radar.search.clearInput();
        this.catalog.clearSearchInput();
        this.radar.resetSearch();
        this.catalog.resetSearchFilter();
      },
    });
  }

  private initShortcuts(): void {
    window.addEventListener('keydown', e => {
      // Cmd/Ctrl + K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (this.state.currentView === 'catalog' && this.catalog.focusSearch()) {
          return;
        }
        this.radar.search.focus();
      }
      // Note: Escape и 1-4 обрабатываются в WorkspaceTabsComponent
    });

    this.drawer.bindDrawerEvents();
  }

  private setupComponents(): void {
    this.drawer.mountDrawer();
    this.headerStatusBar = this.createHeader();

    this.metrics = new MetricsController({
      state: this.state,
      header: this.headerStatusBar,
      onCountsChanged: () => this.updateTabCounts(),
    });
    this.snapshots = new SnapshotController({
      state: this.state,
      header: this.headerStatusBar,
      connectLive: () => liveEventService.connect(),
      onApply: () => this.applySnapshotDataToUI(),
    });
    this.scan = new ScanController({
      state: this.state,
      header: this.headerStatusBar,
      liveEvents: liveEventService,
      snapshots: this.snapshots,
      onScanFinished: () => soundService.playScanFinish(),
    });

    const tickerTrack = document.getElementById('ticker-track');
    if (tickerTrack) {
      this.liveTicker = new LiveTickerComponent({
        container: tickerTrack,
        snapshot: this.state.snapshot,
        onSelectSignal: signal => {
          this.drawer.handleTickerSignalClick(signal);
        },
      });
    }

    this.radar.mount();

    this.updateTabCounts();

    // Prompt Generator Modal Component setup
    this.drawer.mountPromptModal();
  }

  private createHeader(): HeaderStatusBarComponent {
    return new HeaderStatusBarComponent({
      onScan: () => {
        soundService.playClick();
        this.scan.triggerLiveScan();
      },
      onSnapshotSelect: async selectedId => {
        soundService.playClick();
        await this.snapshots.selectSnapshot(selectedId, true);
      },
      onExport: format => {
        soundService.playClick();
        const snapshot = this.state.snapshot;
        if (format === 'md') {
          const md = exportSnapshotToMarkdown(snapshot);
          downloadBlob(md, generateExportFilename(snapshot, 'md'), 'text/markdown;charset=utf-8');
        } else {
          const json = exportSnapshotToJson(snapshot);
          downloadBlob(json, generateExportFilename(snapshot, 'json'), 'application/json;charset=utf-8');
        }
      },
      onSoundToggle: () => {
        const isMuted = soundService.toggleMute();
        updateSoundUI(isMuted);
        if (!isMuted) {
          soundService.playClick();
        }
      },
    });
  }

  /** Бейджи вкладок считаются по снимку, даже пока сами вкладки не смонтированы */
  private updateTabCounts(): void {
    this.catalog.updateCountUI();
    this.arbitrage.updateCountUI();
  }

  /** Новый снимок в state → перерисовать шапку и все смонтированные вкладки. */
  private applySnapshotDataToUI(): void {
    this.metrics.update();
    this.liveTicker?.updateData(this.state.snapshot);
    this.radar.update();
    this.catalog.update();
    this.arbitrage.update();
    this.movers.update();
  }
}

// Instantiate on DOM ready in browser
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    new App();
  });
}
