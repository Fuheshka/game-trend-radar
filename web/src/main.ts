import {
  MarketSnapshot,
  MarketVerdict,
  GameArchetype,
  NormalizedGame,
} from './types.js';
import { escapeHtml, pickOption } from './utils/dom.js';
import { RadarChartComponent, ChartMode } from './components/RadarChart.js';
import { VerdictCardsComponent } from './components/VerdictCards.js';
import { RadarOverviewViewComponent } from './components/RadarOverviewView.js';
import { LiveTickerComponent, TickerSignal } from './components/LiveTicker.js';
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
import {
  POPULAR_SEARCH_TAGS,
  PopularSearchTag,
  isTagActive,
  countGamesForTag,
} from './app/search.js';
import { AppState, createAppState } from './app/state.js';
import { showToast, updateSoundUI } from './app/ui.js';
import { SnapshotController } from './app/snapshotController.js';
import { ScanController } from './app/scanController.js';
import { MetricsController } from './app/metricsController.js';
import { DrawerController } from './app/drawerController.js';
import type { Workspace } from './app/workspaces/workspace.js';
import { CatalogWorkspace, CATALOG_SORTS } from './app/workspaces/catalogWorkspace.js';
import { ArbitrageWorkspace } from './app/workspaces/arbitrageWorkspace.js';
import { MoversWorkspace } from './app/workspaces/moversWorkspace.js';
import {
  VERDICT_SORTS,
  STATUS_FILTERS,
  PLATFORM_FILTERS,
  filterVerdicts,
  sortVerdicts,
} from './app/verdictFilters.js';
import { formatSnapshotDateRu } from './utils/format.js';

export { POPULAR_SEARCH_TAGS, formatSnapshotDateRu, VERDICT_SORTS, STATUS_FILTERS, PLATFORM_FILTERS, CATALOG_SORTS };
export type { PopularSearchTag };


class App {
  private state: AppState = createAppState();
  private drawer = new DrawerController({
    state: this.state,
    onFilterSearch: (query, archetype) => this.applyFilterFromSignal(query, archetype),
  });
  private radarOverviewView?: RadarOverviewViewComponent;
  private radarChart!: RadarChartComponent;
  private verdictCards!: VerdictCardsComponent;
  private liveTicker!: LiveTickerComponent;
  private catalog = new CatalogWorkspace({ state: this.state, drawer: this.drawer });
  private arbitrage = new ArbitrageWorkspace({ state: this.state, drawer: this.drawer });
  private movers = new MoversWorkspace({ state: this.state, drawer: this.drawer });
  private workspaces: Partial<Record<WorkspaceId, Workspace>> = {
    catalog: this.catalog,
    arbitrage: this.arbitrage,
    movers: this.movers,
  };
  private workspaceTabs!: WorkspaceTabsComponent;
  private headerStatusBar!: HeaderStatusBarComponent;
  private snapshots!: SnapshotController;
  private scan!: ScanController;
  private metrics!: MetricsController;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.initElements();
    this.initWorkspaceTabs();
    this.initShortcuts();

    // Initial render with fallback data while fetching live snapshot
    this.setupComponents();
    this.enhanceVerdictCardsWithPromptButton();
    this.metrics.update();
    this.renderLegend();
    this.renderSearchTags();

    // Подписки на SSE; подключается fetchSnapshots, когда API доступен
    this.scan.subscribe();
    setInterval(() => this.metrics.refreshFreshness(), 60_000);

    // Fetch live snapshots list & data from backend
    await this.snapshots.fetchSnapshots();
  }

  private initElements(): void {
    // Sound toggle initial state
    updateSoundUI(soundService.isMuted());

    // Mode toggles for Radar Chart
    const toggleSpider = document.getElementById('toggle-spider');
    const togglePolar = document.getElementById('toggle-polar');

    toggleSpider?.addEventListener('click', () => {
      toggleSpider.classList.add('active');
      togglePolar?.classList.remove('active');
      if (this.radarOverviewView) {
        this.radarOverviewView.setMode('spider');
      } else {
        this.radarChart?.setMode('spider');
      }
      soundService.playClick();
    });

    togglePolar?.addEventListener('click', () => {
      togglePolar.classList.add('active');
      toggleSpider?.classList.remove('active');
      if (this.radarOverviewView) {
        this.radarOverviewView.setMode('polar');
      } else {
        this.radarChart?.setMode('polar');
      }
      soundService.playClick();
    });

    // Search input & quick clear button
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    const searchClearBtn = document.getElementById('search-clear-btn');

    const updateSearchClearVisibility = () => {
      if (searchClearBtn) {
        searchClearBtn.classList.toggle('visible', !!searchInput?.value.trim());
      }
    };

    searchInput?.addEventListener('input', e => {
      this.state.filters.searchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
      updateSearchClearVisibility();
      this.updateActiveSearchTagUI();
      this.radarChart?.updateData(this.getFilteredVerdicts(), this.state.filters.archetype);
      this.applyFiltersAndSort();
    });

    searchClearBtn?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      this.state.filters.searchQuery = '';
      updateSearchClearVisibility();
      this.updateActiveSearchTagUI();
      soundService.playClick();
      this.radarChart?.updateData(this.getFilteredVerdicts(), this.state.filters.archetype);
      this.applyFiltersAndSort();
    });

    // Sort select
    const sortSelect = document.getElementById('sort-select') as HTMLSelectElement;
    sortSelect?.addEventListener('change', e => {
      this.state.filters.sortBy = pickOption((e.target as HTMLSelectElement).value, VERDICT_SORTS) ?? 'score_desc';
      soundService.playClick();
      this.applyFiltersAndSort();
    });

    // Platform filter pills
    const platformPills = document.querySelectorAll<HTMLButtonElement>('[data-platform]');
    platformPills.forEach(pill => {
      pill.addEventListener('click', () => {
        platformPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.state.filters.platform = pickOption(pill.getAttribute('data-platform'), PLATFORM_FILTERS) ?? 'all';
        soundService.playClick();
        this.applyFiltersAndSort();
      });
    });

    // Status filter pills
    const statusPills = document.querySelectorAll<HTMLButtonElement>('[data-status]');
    statusPills.forEach(pill => {
      pill.addEventListener('click', () => {
        statusPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.state.filters.status = pickOption(pill.getAttribute('data-status'), STATUS_FILTERS) ?? 'all';
        soundService.playClick();
        this.applyFiltersAndSort();
      });
    });

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
        this.workspaces[workspace]?.show();
      },
      onEscape: () => {
        // Close drawer if open, otherwise clear search
        if (this.drawer.closeIfOpen()) return;
        const searchInput = document.getElementById('search-input') as HTMLInputElement;
        const searchClearBtn = document.getElementById('search-clear-btn');
        if (searchInput) searchInput.value = '';
        if (searchClearBtn) searchClearBtn.classList.remove('visible');
        this.catalog.clearSearchInput();
        this.state.filters.searchQuery = '';
        this.state.filters.archetype = null;
        this.updateActiveSearchTagUI();
        this.radarChart?.updateData(this.getFilteredVerdicts(), null);
        this.applyFiltersAndSort();
        this.renderLegend();
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
        const searchInput = document.getElementById('search-input') as HTMLInputElement;
        searchInput?.focus();
        searchInput?.select();
      }
      // Note: Escape и 1-4 обрабатываются в WorkspaceTabsComponent
    });

    this.drawer.bindDrawerEvents();
  }


  private exportMarketReportMd(): void {
    const md = exportSnapshotToMarkdown(this.state.snapshot);
    const filename = generateExportFilename(this.state.snapshot, 'md');
    downloadBlob(md, filename, 'text/markdown;charset=utf-8');
  }

  private exportRawJson(): void {
    const json = exportSnapshotToJson(this.state.snapshot);
    const filename = generateExportFilename(this.state.snapshot, 'json');
    downloadBlob(json, filename, 'application/json;charset=utf-8');
  }

  private setupComponents(): void {
    const radarContainer = document.getElementById('radar-chart-container');
    const verdictsContainer = document.getElementById('verdicts-container');
    const tickerTrack = document.getElementById('ticker-track');
    this.drawer.mountDrawer();

    this.headerStatusBar = new HeaderStatusBarComponent({
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
        if (format === 'md') {
          this.exportMarketReportMd();
        } else {
          this.exportRawJson();
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

    if (tickerTrack) {
      this.liveTicker = new LiveTickerComponent({
        container: tickerTrack,
        snapshot: this.state.snapshot,
        onSelectSignal: signal => {
          this.drawer.handleTickerSignalClick(signal);
        },
      });
    }

    const radarOverviewContainer = document.getElementById('radar-overview-container');
    if (radarOverviewContainer) {
      this.radarOverviewView = new RadarOverviewViewComponent({
        container: radarOverviewContainer,
        verdicts: this.getFilteredVerdicts(),
        previousVerdicts: this.state.previousSnapshot?.verdicts,
        activeArchetype: this.state.filters.archetype,
        onSelectArchetype: archetype => {
          this.state.filters.archetype = archetype;
          if (archetype) {
            soundService.playRadarPing();
            this.drawer.openArchetypeDetail(archetype);
          } else {
            soundService.playClick();
          }
          this.radarChart.updateData(this.getFilteredVerdicts(), this.state.filters.archetype);
          this.applyFiltersAndSort();
          this.renderLegend();
        },
        onHoverArchetype: archetype => {
          if (archetype) {
            this.radarOverviewView?.highlightArchetype(archetype, true);
          } else if (!this.state.filters.archetype) {
            this.verdictCards?.clearHighlight();
          }
        },
        onCardClick: archetype => {
          this.drawer.openArchetypeDetail(archetype);
        },
        onGeneratePrompt: archetype => {
          this.drawer.openPromptModalForArchetype(archetype);
        },
        onSelectTag: tag => {
          soundService.playClick();
          const searchInput = document.getElementById('search-input') as HTMLInputElement;
          if (searchInput) {
            searchInput.value = tag;
            this.state.filters.searchQuery = tag.toLowerCase();
            this.applyFiltersAndSort();
          }
        },
        onSelectGame: (title, archetype) => {
          this.drawer.openGameDetail(title, archetype);
        },
        onModeChange: () => {
          soundService.playClick();
        },
      });

      this.radarChart = this.radarOverviewView.radarChart;
      this.verdictCards = this.radarOverviewView.verdictCards;

      radarContainer?.addEventListener('click', e => {
        const target = e.target as SVGElement;
        const blip = target.closest('.radar-blip-group, .polar-blip-group') as SVGElement;
        if (blip && this.state.filters.archetype) {
          this.drawer.openArchetypeDetail(this.state.filters.archetype);
        }
      });
    } else {
      if (radarContainer) {
        this.radarChart = new RadarChartComponent({
          container: radarContainer,
          verdicts: this.state.snapshot.verdicts,
          activeArchetype: this.state.filters.archetype,
          onSelectArchetype: archetype => {
            this.state.filters.archetype = archetype;
            if (archetype) {
              soundService.playRadarPing();
              this.drawer.openArchetypeDetail(archetype);
            } else {
              soundService.playClick();
            }
            this.radarChart.updateData(this.getFilteredVerdicts(), this.state.filters.archetype);
            this.applyFiltersAndSort();
            this.renderLegend();
          },
        });

        // Delegated click on radar chart blips/points
        radarContainer.addEventListener('click', e => {
          const target = e.target as SVGElement;
          const blip = target.closest('.radar-blip-group, .polar-blip-group') as SVGElement;
          if (blip) {
            if (this.state.filters.archetype) {
              this.drawer.openArchetypeDetail(this.state.filters.archetype);
            }
          }
        });
      }

      if (verdictsContainer) {
        this.verdictCards = new VerdictCardsComponent({
          container: verdictsContainer,
          verdicts: this.getFilteredVerdicts(),
          previousVerdicts: this.state.previousSnapshot?.verdicts,
          onSelectTag: tag => {
            soundService.playClick();
            const searchInput = document.getElementById('search-input') as HTMLInputElement;
            if (searchInput) {
              searchInput.value = tag;
              this.state.filters.searchQuery = tag.toLowerCase();
              this.applyFiltersAndSort();
            }
          },
        });

        // Event delegation for clicks on chips, tags, and verdict cards
        verdictsContainer.addEventListener('click', e => {
          const target = e.target as HTMLElement;

          // 0. Click on "Сгенерировать ТЗ для ИИ" button inside card
          const promptBtn = target.closest('.btn-generate-ai-spec') as HTMLElement;
          if (promptBtn) {
            e.stopPropagation();
            const arch = promptBtn.getAttribute('data-archetype') as GameArchetype;
            if (arch) {
              this.drawer.openPromptModalForArchetype(arch);
            }
            return;
          }

          // 1. Click on game sample chip
          const chip = target.closest('.game-sample-chip') as HTMLElement;
          if (chip) {
            e.stopPropagation();
            const card = chip.closest('.verdict-card') as HTMLElement;
            const arch = card?.getAttribute('data-archetype') as GameArchetype | undefined;
            const title = chip.getAttribute('title') || chip.textContent?.trim() || '';
            this.drawer.openGameDetail(title, arch);
            return;
          }

          // 2. Click on archetype tag inside card
          const tagChip = target.closest('.card-archetype-tag') as HTMLElement;
          if (tagChip) {
            e.stopPropagation();
            const card = tagChip.closest('.verdict-card') as HTMLElement;
            const arch = card?.getAttribute('data-archetype') as GameArchetype;
            if (arch) {
              this.drawer.openArchetypeDetail(arch);
            }
            return;
          }

          // 3. Click on verdict card itself
          const card = target.closest('.verdict-card') as HTMLElement;
          if (card) {
            const arch = card.getAttribute('data-archetype') as GameArchetype;
            if (arch) {
              this.drawer.openArchetypeDetail(arch);
            }
          }
        });
      }
    }

    // Бейджи вкладок считаются по снимку, даже пока сами вкладки не смонтированы
    this.updateTabCounts();

    // Prompt Generator Modal Component setup
    this.drawer.mountPromptModal();
  }

  private applyFilterFromSignal(query: string, archetype?: GameArchetype): void {
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    const searchClearBtn = document.getElementById('search-clear-btn');
    if (searchInput) {
      searchInput.value = query;
      this.state.filters.searchQuery = query.toLowerCase();
    }
    if (searchClearBtn) {
      searchClearBtn.classList.toggle('visible', !!query.trim());
    }
    if (archetype) {
      this.state.filters.archetype = archetype;
    }

    // Reset status and platform filters to 'all' so matching game/verdict is visible
    this.state.filters.platform = 'all';
    this.state.filters.status = 'all';
    const platformPills = document.querySelectorAll<HTMLButtonElement>('[data-platform]');
    platformPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-platform') === 'all'));
    const statusPills = document.querySelectorAll<HTMLButtonElement>('[data-status]');
    statusPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-status') === 'all'));

    this.updateActiveSearchTagUI();
    this.radarChart?.updateData(this.getFilteredVerdicts(), this.state.filters.archetype);
    this.applyFiltersAndSort();
    this.renderLegend();
  }

  /** Бейджи вкладок считаются по снимку, даже пока сами вкладки не смонтированы */
  private updateTabCounts(): void {
    this.catalog.updateCountUI();
    this.arbitrage.updateCountUI();
  }

  private applySnapshotDataToUI(): void {
    this.metrics.update();
    this.renderLegend();
    this.renderSearchTags();
    this.liveTicker?.updateData(this.state.snapshot);
    this.radarChart?.updateData(this.state.snapshot.verdicts, this.state.filters.archetype);
    this.catalog.update();
    this.arbitrage.update();
    this.movers.update();
    this.applyFiltersAndSort();
  }

  private renderLegend(): void {
    const legendContainer = document.getElementById('radar-legend-container');
    if (!legendContainer) return;

    legendContainer.innerHTML = '';

    this.state.snapshot.verdicts.forEach(v => {
      const item = document.createElement('div');
      item.className = 'legend-item' + (this.state.filters.archetype === v.archetype ? ' active' : '');

      const color =
        v.status === 'GREEN_LIGHT'
          ? '#10b981'
          : v.status === 'YELLOW_LIGHT'
          ? '#f59e0b'
          : '#ef4444';

      item.innerHTML = `
        <div class="legend-left">
          <span class="legend-marker" style="background: ${color}; box-shadow: 0 0 8px ${color};"></span>
          <span class="legend-name">${escapeHtml(v.titleRu)}</span>
        </div>
        <span class="legend-score" style="color: ${color};">${v.opportunityScore.overallScore} pts</span>
      `;

      item.addEventListener('click', () => {
        this.state.filters.archetype = this.state.filters.archetype === v.archetype ? null : v.archetype;
        if (this.state.filters.archetype) {
          soundService.playRadarPing();
          this.drawer.openArchetypeDetail(this.state.filters.archetype);
        } else {
          soundService.playClick();
        }
        this.radarChart.updateData(this.getFilteredVerdicts(), this.state.filters.archetype);
        this.applyFiltersAndSort();
        this.renderLegend();
      });

      legendContainer.appendChild(item);
    });
  }

  private getFilteredVerdicts(): MarketVerdict[] {
    return filterVerdicts(this.state.snapshot, this.state.filters);
  }

  private applyFiltersAndSort(): void {
    const filtered = this.getFilteredVerdicts();

    sortVerdicts(filtered, this.state.filters.sortBy);

    const countText = document.getElementById('verdicts-count-text');
    if (countText) {
      countText.textContent = `Отображается ${filtered.length} из ${this.state.snapshot.verdicts?.length || 0}`;
    }

    if (this.radarOverviewView) {
      this.radarOverviewView.updateData(filtered, this.state.previousSnapshot?.verdicts, this.state.filters.archetype);
    } else {
      this.verdictCards?.updateData(filtered, this.state.previousSnapshot?.verdicts);
    }
    this.enhanceVerdictCardsWithPromptButton();
  }

  private enhanceVerdictCardsWithPromptButton(): void {
    const cards = document.querySelectorAll<HTMLElement>('#verdicts-container .verdict-card');
    cards.forEach(card => {
      if (card.querySelector('.btn-generate-ai-spec')) return;
      const arch = card.getAttribute('data-archetype') as GameArchetype;
      if (!arch) return;

      const footer = document.createElement('div');
      footer.className = 'verdict-card-footer';
      footer.innerHTML = `
        <button type="button" class="btn-generate-ai-spec" data-archetype="${arch}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span>Сгенерировать ТЗ для ИИ</span>
        </button>
      `;
      card.appendChild(footer);
    });
  }

  private renderSearchTags(): void {
    const scrollContainer = document.getElementById('search-tags-scroll');
    if (!scrollContainer) return;

    scrollContainer.innerHTML = '';

    for (const tag of POPULAR_SEARCH_TAGS) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'search-tag-chip';
      chip.setAttribute('data-tag-id', tag.id);
      chip.setAttribute('data-query', tag.query);
      chip.setAttribute('data-label', tag.label);

      const isActive = isTagActive(tag, this.state.filters.searchQuery);
      if (isActive) {
        chip.classList.add('active');
      }

      const matchCount = countGamesForTag(tag, this.state.snapshot);
      const countBadge = matchCount > 0 ? `<span class="search-tag-count">${matchCount}</span>` : '';

      chip.innerHTML = `
        <span class="search-tag-text">${escapeHtml(tag.label)}</span>
        ${countBadge}
      `;

      chip.addEventListener('click', () => {
        const searchInput = document.getElementById('search-input') as HTMLInputElement;
        const searchClearBtn = document.getElementById('search-clear-btn');
        soundService.playClick();

        if (isTagActive(tag, this.state.filters.searchQuery)) {
          // Toggle off if currently active
          if (searchInput) searchInput.value = '';
          this.state.filters.searchQuery = '';
          if (searchClearBtn) searchClearBtn.classList.remove('visible');
        } else {
          // Apply tag filter
          if (searchInput) searchInput.value = tag.label;
          this.state.filters.searchQuery = tag.query.toLowerCase();
          if (searchClearBtn) searchClearBtn.classList.add('visible');
        }

        this.updateActiveSearchTagUI();
        this.radarChart?.updateData(this.getFilteredVerdicts(), this.state.filters.archetype);
        this.applyFiltersAndSort();
      });

      scrollContainer.appendChild(chip);
    }
  }

  private updateActiveSearchTagUI(): void {
    const chips = document.querySelectorAll<HTMLButtonElement>('.search-tag-chip');
    chips.forEach(chip => {
      const q = chip.getAttribute('data-query') || '';
      const label = chip.getAttribute('data-label') || '';
      const tag: PopularSearchTag = { id: chip.getAttribute('data-tag-id') || '', label, query: q };
      chip.classList.toggle('active', isTagActive(tag, this.state.filters.searchQuery));
    });
  }

}

// Instantiate on DOM ready in browser
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    new App();
  });
}
