import {
  MarketSnapshot,
  MarketVerdict,
  GameArchetype,
  PlatformType,
  NormalizedGame,
  SnapshotSummary,
  PLATFORM_TYPES,
} from './types.js';
import { FALLBACK_SNAPSHOT } from './fallbackData.js';
import { escapeHtml, pickOption } from './utils/dom.js';
import { RadarChartComponent, ChartMode } from './components/RadarChart.js';
import { VerdictCardsComponent } from './components/VerdictCards.js';
import { RadarOverviewViewComponent } from './components/RadarOverviewView.js';
import { LiveTickerComponent, TickerSignal } from './components/LiveTicker.js';
import { DetailDrawerComponent } from './components/DetailDrawer.js';
import { GameTableViewComponent, TableSortColumn, TableSortDirection } from './components/GameTableView.js';
import { ArbitrageMatrixComponent } from './components/ArbitrageMatrix.js';
import { MoversViewComponent } from './components/MoversView.js';
import { PromptGeneratorModalComponent } from './components/PromptGeneratorModal.js';
import { WorkspaceTabsComponent, WorkspaceId } from './components/WorkspaceTabs.js';
import { HeaderStatusBarComponent, formatMinutesAgo } from './components/HeaderStatusBar.js';
import { animateCounter } from './utils/animation.js';
import { soundService } from './services/sound.js';
import { liveEventService, ScanProgressData, ScanCompletedData } from './services/liveEventService.js';
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
  verdictMatchesQuery,
} from './app/search.js';
import { computeMarketMetrics } from './app/metrics.js';
import {
  fetchSnapshotList,
  fetchSnapshotById,
  fetchLatestSnapshot,
  fetchStaticSnapshot,
  requestScan,
  storeScanToken,
} from './services/snapshotApi.js';
import { formatSnapshotDateRu, formatCompactNumber } from './utils/format.js';

export { POPULAR_SEARCH_TAGS, formatSnapshotDateRu };
export type { PopularSearchTag };


export const VERDICT_SORTS = ['score_desc', 'score_asc', 'ccu_desc', 'velocity_desc', 'title_asc'] as const;
type VerdictSort = (typeof VERDICT_SORTS)[number];
export const STATUS_FILTERS = ['all', 'GREEN_LIGHT', 'YELLOW_LIGHT', 'RED_LIGHT', 'arbitrage'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
export const PLATFORM_FILTERS = ['all', ...PLATFORM_TYPES] as const;

/** Значения селекта сортировки каталога → колонка и направление таблицы. */
export const CATALOG_SORTS: Record<string, [TableSortColumn, TableSortDirection]> = {
  ccu_desc: ['ccu', 'desc'],
  ccu_asc: ['ccu', 'asc'],
  likes_desc: ['likes', 'desc'],
  title_asc: ['title', 'asc'],
};

class App {
  private snapshot: MarketSnapshot = FALLBACK_SNAPSHOT;
  private snapshotsList: SnapshotSummary[] = [];
  private snapshotsCache: Map<string, MarketSnapshot> = new Map();
  private currentSnapshotId: string = '';
  private previousSnapshot: MarketSnapshot | null = null;
  private activePlatform: 'all' | PlatformType = 'all';
  private activeStatus: StatusFilter = 'all';
  private activeArchetype: GameArchetype | null = null;
  private searchQuery: string = '';
  private sortBy: VerdictSort = 'score_desc';
  private isScanning: boolean = false;
  private currentView: WorkspaceId = 'radar';
  private metricsInitialized = false;
  private localScanRequested = false;
  private prevMetrics = {
    totalGames: 0,
    totalCcu: 0,
    topScore: 0,
    arbitrageCount: 0,
  };
  /** Снимок, чьи метрики сейчас на экране — демо-данные не годятся базой для % изменения CCU. */
  private metricsSnapshotId: string | null = null;

  private radarOverviewView?: RadarOverviewViewComponent;
  private radarChart!: RadarChartComponent;
  private verdictCards!: VerdictCardsComponent;
  private liveTicker!: LiveTickerComponent;
  private detailDrawer!: DetailDrawerComponent;
  private gameTableView?: GameTableViewComponent;
  private arbitrageMatrix?: ArbitrageMatrixComponent;
  private moversView?: MoversViewComponent;
  private promptModal!: PromptGeneratorModalComponent;
  private workspaceTabs!: WorkspaceTabsComponent;
  private headerStatusBar!: HeaderStatusBarComponent;
  private currentDrawerVerdict: MarketVerdict | null = null;

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
    this.updateGlobalMetrics();
    this.renderLegend();
    this.renderSearchTags();

    // Setup real-time SSE stream connection
    this.setupLiveEventService();
    setInterval(() => this.refreshFreshness(), 60_000);

    // Fetch live snapshots list & data from backend
    await this.fetchSnapshots();
  }

  private initElements(): void {
    // Sound toggle initial state
    this.updateSoundUI(soundService.isMuted());

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
      this.searchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
      updateSearchClearVisibility();
      this.updateActiveSearchTagUI();
      this.radarChart?.updateData(this.getFilteredVerdicts(), this.activeArchetype);
      this.applyFiltersAndSort();
    });

    searchClearBtn?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      this.searchQuery = '';
      updateSearchClearVisibility();
      this.updateActiveSearchTagUI();
      soundService.playClick();
      this.radarChart?.updateData(this.getFilteredVerdicts(), this.activeArchetype);
      this.applyFiltersAndSort();
    });

    // Sort select
    const sortSelect = document.getElementById('sort-select') as HTMLSelectElement;
    sortSelect?.addEventListener('change', e => {
      this.sortBy = pickOption((e.target as HTMLSelectElement).value, VERDICT_SORTS) ?? 'score_desc';
      soundService.playClick();
      this.applyFiltersAndSort();
    });

    // Platform filter pills
    const platformPills = document.querySelectorAll<HTMLButtonElement>('[data-platform]');
    platformPills.forEach(pill => {
      pill.addEventListener('click', () => {
        platformPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activePlatform = pickOption(pill.getAttribute('data-platform'), PLATFORM_FILTERS) ?? 'all';
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
        this.activeStatus = pickOption(pill.getAttribute('data-status'), STATUS_FILTERS) ?? 'all';
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

    // Catalog Min CCU Slider & Presets
    const ccuSlider = document.getElementById('catalog-ccu-slider') as HTMLInputElement;
    const ccuPresets = document.querySelectorAll<HTMLButtonElement>('.ccu-preset-btn');

    const updateSliderUI = (val: number) => {
      this.updateCcuSliderBadge(val);
      ccuPresets.forEach(btn => {
        const presetVal = parseInt(btn.getAttribute('data-ccu') || '0', 10);
        btn.classList.toggle('active', presetVal === val);
      });
      if (this.gameTableView) {
        this.gameTableView.setMinCcu(val);
        this.updateCatalogCountUI();
      }
    };

    ccuSlider?.addEventListener('input', e => {
      const val = parseInt((e.target as HTMLInputElement).value, 10) || 0;
      updateSliderUI(val);
    });

    ccuPresets.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.getAttribute('data-ccu') || '0', 10);
        if (ccuSlider) ccuSlider.value = val.toString();
        soundService.playClick();
        updateSliderUI(val);
      });
    });

    // Catalog Search Input & quick clear button
    const catalogSearchInput = document.getElementById('catalog-search-input') as HTMLInputElement;
    const catalogClearBtn = document.getElementById('catalog-search-clear-btn');

    const updateCatalogClearVisibility = () => {
      if (catalogClearBtn) {
        catalogClearBtn.classList.toggle('visible', !!catalogSearchInput?.value.trim());
      }
    };

    catalogSearchInput?.addEventListener('input', e => {
      const query = (e.target as HTMLInputElement).value;
      updateCatalogClearVisibility();
      if (this.gameTableView) {
        this.gameTableView.setSearchQuery(query);
        this.updateCatalogCountUI();
      }
    });

    catalogClearBtn?.addEventListener('click', () => {
      if (catalogSearchInput) {
        catalogSearchInput.value = '';
        catalogSearchInput.focus();
      }
      updateCatalogClearVisibility();
      soundService.playClick();
      if (this.gameTableView) {
        this.gameTableView.setSearchQuery('');
        this.updateCatalogCountUI();
      }
    });

    // Catalog Platform Filter Pills
    const catalogPlatformPills = document.querySelectorAll<HTMLButtonElement>('[data-catalog-platform]');
    catalogPlatformPills.forEach(pill => {
      pill.addEventListener('click', () => {
        catalogPlatformPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const platform = pickOption(pill.getAttribute('data-catalog-platform'), PLATFORM_FILTERS) ?? 'all';
        soundService.playClick();
        if (this.gameTableView) {
          this.gameTableView.setPlatform(platform);
          this.updateCatalogCountUI();
        }
      });
    });

    // Catalog Sort Select
    const catalogSortSelect = document.getElementById('catalog-sort-select') as HTMLSelectElement;
    catalogSortSelect?.addEventListener('change', e => {
      const sort = CATALOG_SORTS[(e.target as HTMLSelectElement).value];
      soundService.playClick();
      if (this.gameTableView && sort) {
        this.gameTableView.setSort(sort[0], sort[1]);
      }
    });

    // Catalog View Mode Toggles (Grid / Table)
    const btnViewGrid = document.getElementById('btn-view-grid');
    const btnViewTable = document.getElementById('btn-view-table');

    btnViewGrid?.addEventListener('click', () => {
      btnViewGrid.classList.add('active');
      btnViewTable?.classList.remove('active');
      soundService.playClick();
      this.gameTableView?.setViewMode('grid');
    });

    btnViewTable?.addEventListener('click', () => {
      btnViewTable.classList.add('active');
      btnViewGrid?.classList.remove('active');
      soundService.playClick();
      this.gameTableView?.setViewMode('table');
    });
  }

  private initWorkspaceTabs(): void {
    this.workspaceTabs = new WorkspaceTabsComponent({
      initial: 'radar',
      onSwitch: (workspace: WorkspaceId) => {
        this.currentView = workspace;
        soundService.playClick();
        this.mountWorkspace(workspace);
        if (workspace === 'catalog') {
          this.updateCatalogCountUI();
        } else if (workspace === 'arbitrage') {
          this.updateArbitrageCountUI();
        }
      },
      onEscape: () => {
        // Close drawer if open, otherwise clear search
        const drawer = document.getElementById('game-drawer');
        if (drawer && drawer.getAttribute('aria-hidden') === 'false') {
          this.detailDrawer?.close?.();
          return;
        }
        const searchInput = document.getElementById('search-input') as HTMLInputElement;
        const searchClearBtn = document.getElementById('search-clear-btn');
        const catalogSearchInput = document.getElementById('catalog-search-input') as HTMLInputElement;
        const catalogClearBtn = document.getElementById('catalog-search-clear-btn');
        if (searchInput) searchInput.value = '';
        if (searchClearBtn) searchClearBtn.classList.remove('visible');
        if (catalogSearchInput) catalogSearchInput.value = '';
        if (catalogClearBtn) catalogClearBtn.classList.remove('visible');
        this.searchQuery = '';
        this.activeArchetype = null;
        this.updateActiveSearchTagUI();
        this.radarChart?.updateData(this.getFilteredVerdicts(), null);
        this.applyFiltersAndSort();
        this.renderLegend();
        if (this.gameTableView) {
          this.gameTableView.setSearchQuery('');
          this.updateCatalogCountUI();
        }
      },
    });
  }

  private initShortcuts(): void {
    window.addEventListener('keydown', e => {
      // Cmd/Ctrl + K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (this.currentView === 'catalog') {
          const tableSearchInput = document.getElementById('catalog-search-input') as HTMLInputElement;
          if (tableSearchInput) {
            tableSearchInput.focus();
            tableSearchInput.select();
            return;
          }
        }
        const searchInput = document.getElementById('search-input') as HTMLInputElement;
        searchInput?.focus();
        searchInput?.select();
      }
      // Note: Escape и 1-4 обрабатываются в WorkspaceTabsComponent
    });

    // Drawer click delegation for AI spec generator button
    const gameDrawerEl = document.getElementById('game-drawer');
    gameDrawerEl?.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      const specBtn = target.closest('#drawer-btn-generate-spec');
      if (specBtn) {
        e.stopPropagation();
        if (this.currentDrawerVerdict) {
          this.openPromptModalForArchetype(this.currentDrawerVerdict.archetype);
        }
      }
    });

    if (gameDrawerEl) {
      const observer = new MutationObserver(() => {
        if (this.currentDrawerVerdict) {
          const footerActions = gameDrawerEl.querySelector('.drawer-footer-actions');
          const filterBtn = gameDrawerEl.querySelector('#drawer-btn-filter-archetype');
          if (footerActions && filterBtn && !footerActions.querySelector('#drawer-btn-generate-spec')) {
            this.injectDrawerPromptButton(this.currentDrawerVerdict);
          }
        }
      });
      observer.observe(gameDrawerEl, { childList: true, subtree: true });
    }
  }

  private updateSoundUI(muted: boolean): void {
    const btnSoundToggle = document.getElementById('btn-sound-toggle');
    const soundToggleLabel = document.getElementById('sound-toggle-label');
    btnSoundToggle?.classList.toggle('active', !muted);
    if (soundToggleLabel) {
      soundToggleLabel.textContent = muted ? 'Mute' : 'Sound On';
    }
  }

  private exportMarketReportMd(): void {
    const md = exportSnapshotToMarkdown(this.snapshot);
    const filename = generateExportFilename(this.snapshot, 'md');
    downloadBlob(md, filename, 'text/markdown;charset=utf-8');
  }

  private exportRawJson(): void {
    const json = exportSnapshotToJson(this.snapshot);
    const filename = generateExportFilename(this.snapshot, 'json');
    downloadBlob(json, filename, 'application/json;charset=utf-8');
  }

  private setupComponents(): void {
    const radarContainer = document.getElementById('radar-chart-container');
    const verdictsContainer = document.getElementById('verdicts-container');
    const tickerTrack = document.getElementById('ticker-track');
    const drawerBackdrop = document.getElementById('drawer-backdrop');
    const gameDrawer = document.getElementById('game-drawer');

    if (drawerBackdrop && gameDrawer) {
      this.detailDrawer = new DetailDrawerComponent({
        backdrop: drawerBackdrop,
        drawer: gameDrawer,
        onFilterSearch: (query, archetype) => {
          this.applyFilterFromSignal(query, archetype);
        },
        showToast: msg => this.showToast(msg),
        onSelectGame: game => {
          this.openGameDetail(game.title, game.archetype);
        },
        onSelectArchetype: archetype => {
          this.openArchetypeDetail(archetype);
        },
      });
    }

    this.headerStatusBar = new HeaderStatusBarComponent({
      onScan: () => {
        soundService.playClick();
        this.triggerLiveScan();
      },
      onSnapshotSelect: async selectedId => {
        soundService.playClick();
        await this.selectSnapshot(selectedId, true);
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
        this.updateSoundUI(isMuted);
        if (!isMuted) {
          soundService.playClick();
        }
      },
    });

    if (tickerTrack) {
      this.liveTicker = new LiveTickerComponent({
        container: tickerTrack,
        snapshot: this.snapshot,
        onSelectSignal: signal => {
          this.handleTickerSignalClick(signal);
        },
      });
    }

    const radarOverviewContainer = document.getElementById('radar-overview-container');
    if (radarOverviewContainer) {
      this.radarOverviewView = new RadarOverviewViewComponent({
        container: radarOverviewContainer,
        verdicts: this.getFilteredVerdicts(),
        previousVerdicts: this.previousSnapshot?.verdicts,
        activeArchetype: this.activeArchetype,
        onSelectArchetype: archetype => {
          this.activeArchetype = archetype;
          if (archetype) {
            soundService.playRadarPing();
            this.openArchetypeDetail(archetype);
          } else {
            soundService.playClick();
          }
          this.radarChart.updateData(this.getFilteredVerdicts(), this.activeArchetype);
          this.applyFiltersAndSort();
          this.renderLegend();
        },
        onHoverArchetype: archetype => {
          if (archetype) {
            this.radarOverviewView?.highlightArchetype(archetype, true);
          } else if (!this.activeArchetype) {
            this.verdictCards?.clearHighlight();
          }
        },
        onCardClick: archetype => {
          this.openArchetypeDetail(archetype);
        },
        onGeneratePrompt: archetype => {
          this.openPromptModalForArchetype(archetype);
        },
        onSelectTag: tag => {
          soundService.playClick();
          const searchInput = document.getElementById('search-input') as HTMLInputElement;
          if (searchInput) {
            searchInput.value = tag;
            this.searchQuery = tag.toLowerCase();
            this.applyFiltersAndSort();
          }
        },
        onSelectGame: (title, archetype) => {
          this.openGameDetail(title, archetype);
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
        if (blip && this.activeArchetype) {
          this.openArchetypeDetail(this.activeArchetype);
        }
      });
    } else {
      if (radarContainer) {
        this.radarChart = new RadarChartComponent({
          container: radarContainer,
          verdicts: this.snapshot.verdicts,
          activeArchetype: this.activeArchetype,
          onSelectArchetype: archetype => {
            this.activeArchetype = archetype;
            if (archetype) {
              soundService.playRadarPing();
              this.openArchetypeDetail(archetype);
            } else {
              soundService.playClick();
            }
            this.radarChart.updateData(this.getFilteredVerdicts(), this.activeArchetype);
            this.applyFiltersAndSort();
            this.renderLegend();
          },
        });

        // Delegated click on radar chart blips/points
        radarContainer.addEventListener('click', e => {
          const target = e.target as SVGElement;
          const blip = target.closest('.radar-blip-group, .polar-blip-group') as SVGElement;
          if (blip) {
            if (this.activeArchetype) {
              this.openArchetypeDetail(this.activeArchetype);
            }
          }
        });
      }

      if (verdictsContainer) {
        this.verdictCards = new VerdictCardsComponent({
          container: verdictsContainer,
          verdicts: this.getFilteredVerdicts(),
          previousVerdicts: this.previousSnapshot?.verdicts,
          onSelectTag: tag => {
            soundService.playClick();
            const searchInput = document.getElementById('search-input') as HTMLInputElement;
            if (searchInput) {
              searchInput.value = tag;
              this.searchQuery = tag.toLowerCase();
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
              this.openPromptModalForArchetype(arch);
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
            this.openGameDetail(title, arch);
            return;
          }

          // 2. Click on archetype tag inside card
          const tagChip = target.closest('.card-archetype-tag') as HTMLElement;
          if (tagChip) {
            e.stopPropagation();
            const card = tagChip.closest('.verdict-card') as HTMLElement;
            const arch = card?.getAttribute('data-archetype') as GameArchetype;
            if (arch) {
              this.openArchetypeDetail(arch);
            }
            return;
          }

          // 3. Click on verdict card itself
          const card = target.closest('.verdict-card') as HTMLElement;
          if (card) {
            const arch = card.getAttribute('data-archetype') as GameArchetype;
            if (arch) {
              this.openArchetypeDetail(arch);
            }
          }
        });
      }
    }

    // Бейджи вкладок считаются по снимку, даже пока сами вкладки не смонтированы
    this.updateCatalogCountUI();
    this.updateArbitrageCountUI();

    // Prompt Generator Modal Component setup
    this.promptModal = new PromptGeneratorModalComponent({
      showToast: msg => this.showToast(msg),
      onClose: () => soundService.playClick(),
    });
  }

  /**
   * Тяжёлые вкладки (каталог ~4k узлов, лидеры, арбитраж) монтируются при первом открытии:
   * до этого они скрыты и только раздували DOM и время старта.
   */
  private mountWorkspace(view: WorkspaceId): void {
    // Game Table View Component setup (SteamDB Charts high density view)
    const catalogContainer = document.getElementById('catalog-container');
    if (view === 'catalog' && !this.gameTableView && catalogContainer) {
      this.gameTableView = new GameTableViewComponent({
        container: catalogContainer,
        games: this.snapshot.games || [],
        verdicts: this.snapshot.verdicts || [],
        initialViewMode: 'table',
        onSelectGame: game => {
          soundService.playClick();
          this.detailDrawer.openGame(game, this.snapshot.games);
        },
        onTagClick: tag => {
          soundService.playClick();
          const catalogSearchInput = document.getElementById('catalog-search-input') as HTMLInputElement;
          if (catalogSearchInput) {
            // Через событие input: тот же путь, что ручной ввод (фильтр, счётчик, кнопка ×)
            catalogSearchInput.value = tag;
            catalogSearchInput.dispatchEvent(new Event('input'));
          }
        },
        onFilterChange: () => {
          this.updateCatalogCountUI();
        },
        // Клик по заголовку таблицы: селект показывает совпадающий пресет или пустое значение
        onSortChange: (column, direction) => {
          const select = document.getElementById('catalog-sort-select') as HTMLSelectElement | null;
          if (!select) return;
          const preset = Object.keys(CATALOG_SORTS).find(
            k => CATALOG_SORTS[k][0] === column && CATALOG_SORTS[k][1] === direction
          );
          select.value = preset ?? '';
        },
      });
      this.updateCatalogCountUI();
    }

    // Arbitrage Matrix Component setup
    const arbitrageContainer = document.getElementById('arbitrage-matrix-container');
    if (view === 'arbitrage' && !this.arbitrageMatrix && arbitrageContainer) {
      this.arbitrageMatrix = new ArbitrageMatrixComponent({
        container: arbitrageContainer,
        opportunities: this.snapshot.arbitrageOpportunities || [],
        onSelectGame: game => {
          soundService.playClick();
          this.detailDrawer.openGame(game, this.snapshot.games);
        },
        onOpenRoblox: url => {
          soundService.playClick();
          window.open(url, '_blank', 'noopener,noreferrer');
        },
      });
      this.updateArbitrageCountUI();
    }

    // Movers View Component setup (DefiLlama Movers & Shakers)
    const moversContainer = document.getElementById('view-movers');
    if (view === 'movers' && !this.moversView && moversContainer) {
      this.moversView = new MoversViewComponent({
        container: moversContainer,
        currentSnapshot: this.snapshot,
        previousSnapshot: this.previousSnapshot,
        onSelectGame: game => {
          soundService.playClick();
          this.detailDrawer.openGame(game, this.snapshot.games);
        },
        onSelectArchetype: archetype => {
          soundService.playClick();
          const verdict = this.snapshot.verdicts.find(v => v.archetype === archetype);
          if (verdict) {
            this.detailDrawer.openArchetype(verdict, this.snapshot.games);
          }
        },
      });
    }
  }

  /** Программный переход к вкладке — делегируем WorkspaceTabsComponent. */
  private switchView(view: WorkspaceId): void {
    this.workspaceTabs?.switchTo(view);
  }

  private updateArbitrageCountUI(): void {
    const tabBadge = document.getElementById('tab-arbitrage-count');
    if (tabBadge) {
      const count = this.arbitrageMatrix
        ? this.arbitrageMatrix.getTotalCount()
        : (this.snapshot.arbitrageOpportunities?.length ?? 0);
      tabBadge.textContent = count.toString();
    }
  }


  private updateCcuSliderBadge(val: number): void {
    const badge = document.getElementById('catalog-ccu-val-text');
    if (badge) {
      if (val === 0) {
        badge.textContent = '0';
      } else if (val >= 100000) {
        badge.textContent = '100k+';
      } else if (val >= 1000) {
        badge.textContent = `${Math.round(val / 1000)}k`;
      } else {
        badge.textContent = val.toLocaleString();
      }
    }
  }

  private updateCatalogCountUI(): void {
    const countText = document.getElementById('catalog-count-text');
    const tabBadge = document.getElementById('tab-games-count');
    const total = this.snapshot.games?.length || this.snapshot.totalGamesScanned || 0;
    const filtered = this.gameTableView ? this.gameTableView.getFilteredCount() : total;

    if (tabBadge) {
      tabBadge.textContent = total.toString();
    }
    if (countText) {
      countText.textContent = `Отображается ${filtered} из ${total}`;
    }
  }

  public openArchetypeDetail(archetype: GameArchetype): void {
    const verdict = (this.snapshot.verdicts || []).find(v => v.archetype === archetype);
    if (!verdict) return;

    this.currentDrawerVerdict = verdict;
    soundService.playRadarPing();
    const games = this.getGamesForArchetype(archetype);
    this.detailDrawer.openArchetype(verdict, games);
    this.injectDrawerPromptButton(verdict);
  }

  public openGameDetail(titleOrId: string, archetypeHint?: GameArchetype): void {
    if (!titleOrId) return;
    soundService.playClick();

    const games = this.snapshot.games || [];
    const lower = titleOrId.toLowerCase().trim();

    // 1. Exact ID or Title match
    let found = games.find(g => g.id === titleOrId || g.title.toLowerCase().trim() === lower);

    // 2. Substring match
    if (!found) {
      found = games.find(
        g => g.title.toLowerCase().includes(lower) || lower.includes(g.title.toLowerCase())
      );
    }

    // 3. Arbitrage match
    if (!found && this.snapshot.arbitrageOpportunities) {
      for (const opp of this.snapshot.arbitrageOpportunities) {
        if (opp.robloxGame && opp.robloxGame.title.toLowerCase().includes(lower)) {
          found = opp.robloxGame;
          break;
        }
        if (opp.nearestAnalog && opp.nearestAnalog.title.toLowerCase().includes(lower)) {
          found = {
            id: opp.nearestAnalog.id,
            platform: 'yandex_games',
            title: opp.nearestAnalog.title,
            genre: 'Аналог',
            archetype: opp.nearestAnalog.archetype,
            metricValue: Math.round(opp.robloxCCU * 0.15),
            metricType: 'ccu',
            likeRatio: 0.88,
            tags: ['analog', 'arbitrage'],
            timestamp: this.snapshot.timestamp,
          };
          break;
        }
      }
    }

    // 4. Synthesize game if not explicitly present in snapshot
    if (!found) {
      const arch = archetypeHint || 'OTHER_CASUAL';
      const verdict = (this.snapshot.verdicts || []).find(v => v.archetype === arch);
      found = {
        id: `synth_${encodeURIComponent(lower)}`,
        platform: 'roblox',
        title: titleOrId,
        genre: verdict ? verdict.titleRu : 'Казуальные',
        archetype: arch,
        metricValue: verdict
          ? Math.round(verdict.totalAudienceCCU / Math.max(1, verdict.sampleTitles.length))
          : 25000,
        metricType: 'ccu',
        likeRatio: 0.92,
        tags: [arch, 'Sample', 'Trending'],
        timestamp: this.snapshot.timestamp || new Date().toISOString(),
        url: `https://www.roblox.com/discover/?Keyword=${encodeURIComponent(titleOrId)}`,
      };
    }

    const archetypeGames = this.getGamesForArchetype(found.archetype);
    const parentVerdict = (this.snapshot.verdicts || []).find(v => v.archetype === found!.archetype);

    this.detailDrawer.openGame(found, archetypeGames, parentVerdict);
  }

  private getGamesForArchetype(archetype: GameArchetype): NormalizedGame[] {
    const games = (this.snapshot.games || []).filter(g => g.archetype === archetype);
    const verdict = (this.snapshot.verdicts || []).find(v => v.archetype === archetype);

    if (verdict && verdict.sampleTitles) {
      const existingTitles = new Set(games.map(g => g.title.toLowerCase().trim()));
      for (const sampleTitle of verdict.sampleTitles) {
        if (!sampleTitle || existingTitles.has(sampleTitle.toLowerCase().trim())) continue;
        games.push({
          id: `sample_${sampleTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
          platform: 'roblox',
          title: sampleTitle,
          genre: verdict.titleRu,
          archetype: archetype,
          metricValue: Math.round(
            (verdict.totalAudienceCCU || 50000) / Math.max(1, verdict.sampleTitles.length)
          ),
          metricType: 'ccu',
          likeRatio: 0.91,
          url: `https://www.roblox.com/discover/?Keyword=${encodeURIComponent(sampleTitle)}`,
          tags: [archetype, 'Sample', 'Trending'],
          timestamp: this.snapshot.timestamp || new Date().toISOString(),
        });
        existingTitles.add(sampleTitle.toLowerCase().trim());
      }
    }
    return games;
  }

  private handleTickerSignalClick(signal: TickerSignal): void {
    if (signal.archetype) {
      soundService.playRadarPing();
    } else {
      soundService.playClick();
    }
    if (this.detailDrawer) {
      this.detailDrawer.openSignal(signal);
    }
    this.applyFilterFromSignal(signal.searchFilter, signal.archetype);
  }

  private applyFilterFromSignal(query: string, archetype?: GameArchetype): void {
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    const searchClearBtn = document.getElementById('search-clear-btn');
    if (searchInput) {
      searchInput.value = query;
      this.searchQuery = query.toLowerCase();
    }
    if (searchClearBtn) {
      searchClearBtn.classList.toggle('visible', !!query.trim());
    }
    if (archetype) {
      this.activeArchetype = archetype;
    }

    // Reset status and platform filters to 'all' so matching game/verdict is visible
    this.activePlatform = 'all';
    this.activeStatus = 'all';
    const platformPills = document.querySelectorAll<HTMLButtonElement>('[data-platform]');
    platformPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-platform') === 'all'));
    const statusPills = document.querySelectorAll<HTMLButtonElement>('[data-status]');
    statusPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-status') === 'all'));

    this.updateActiveSearchTagUI();
    this.radarChart?.updateData(this.getFilteredVerdicts(), this.activeArchetype);
    this.applyFiltersAndSort();
    this.renderLegend();
  }

  private async fetchSnapshots(): Promise<void> {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('server-status-text');

    const list = await fetchSnapshotList();
    if (list) {
      this.snapshotsList = list;
      statusDot?.classList.remove('offline');
      if (statusText) statusText.textContent = 'HTTP :4200 (Online)';

      if (this.snapshotsList.length > 0) {
        this.populateSnapshotSelect();
        // Load the latest snapshot (first in list)
        await this.selectSnapshot(this.snapshotsList[0].id, false);
        return;
      }
    }

    // Fallback: try fetching /api/snapshots/latest or static fallback
    await this.fetchLatestSnapshot();
  }

  private populateSnapshotSelect(): void {
    const options = this.snapshotsList.map(s => ({
      id: s.id,
      label: `${formatSnapshotDateRu(s.date)} (${s.totalGamesScanned} игр)`,
      date: s.date,
      gamesCount: s.totalGamesScanned,
    }));
    this.headerStatusBar?.setSnapshots(options, this.snapshotsList[0]?.id);
  }

  private async selectSnapshot(snapshotId: string, animate: boolean = true): Promise<void> {
    if (!snapshotId) return;

    const select = document.getElementById('snapshot-select') as HTMLSelectElement | null;
    if (select && select.value !== snapshotId) {
      select.value = snapshotId;
    }

    try {
      const data = await fetchSnapshotById(snapshotId, this.snapshotsCache);

      if (data) {
        this.snapshot = data;
        this.currentSnapshotId = snapshotId;

        // Find immediately preceding snapshot in history (idx + 1 in date-descending list)
        const currIdx = this.snapshotsList.findIndex(s => s.id === snapshotId);
        if (currIdx >= 0 && currIdx + 1 < this.snapshotsList.length) {
          const prevSummary = this.snapshotsList[currIdx + 1];
          // Сбой загрузки предыдущего снимка не мешает показать текущий
          const prevData = await fetchSnapshotById(prevSummary.id, this.snapshotsCache).catch(() => undefined);
          this.previousSnapshot = prevData || null;
        } else {
          this.previousSnapshot = null;
        }

        if (animate) {
          this.triggerSnapshotTransitionAnimation();
        }

        this.applySnapshotDataToUI();
      }
    } catch (err) {
      console.error('Failed to load snapshot:', err);
    }
  }

  private triggerSnapshotTransitionAnimation(): void {
    const targets = [
      document.getElementById('verdicts-grid'),
      document.getElementById('radar-chart-container'),
      document.getElementById('metrics-hero-grid'),
      document.getElementById('catalog-content'),
      document.getElementById('arbitrage-matrix-container'),
      document.getElementById('view-movers'),
    ].filter(Boolean) as HTMLElement[];

    targets.forEach(el => {
      el.classList.remove('snapshot-fade-update');
      void el.offsetWidth; // Force reflow
      el.classList.add('snapshot-fade-update');
    });

    setTimeout(() => {
      targets.forEach(el => el.classList.remove('snapshot-fade-update'));
    }, 400);
  }

  private applySnapshotDataToUI(): void {
    this.updateGlobalMetrics();
    this.renderLegend();
    this.renderSearchTags();
    this.liveTicker?.updateData(this.snapshot);
    this.radarChart?.updateData(this.snapshot.verdicts, this.activeArchetype);
    this.gameTableView?.updateData(this.snapshot.games || [], this.snapshot.verdicts || []);
    this.updateCatalogCountUI();
    this.arbitrageMatrix?.updateData(this.snapshot.arbitrageOpportunities || []);
    this.updateArbitrageCountUI();
    this.moversView?.updateData(this.snapshot, this.previousSnapshot);
    this.applyFiltersAndSort();
  }

  private async fetchLatestSnapshot(): Promise<void> {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('server-status-text');

    const data = await fetchLatestSnapshot();
    if (data) {
      this.snapshot = data;
      this.currentSnapshotId = data.id;
      this.snapshotsCache.set(data.id, data);
      statusDot?.classList.remove('offline');
      if (statusText) statusText.textContent = 'HTTP :4200 (Online)';
      this.headerStatusBar?.setSseStatus(true, 'SSE Live');

      // Populate single fallback option if snapshotsList is empty
      const select = document.getElementById('snapshot-select') as HTMLSelectElement | null;
      if (select && select.options.length <= 1) {
        this.headerStatusBar?.setSnapshots([
          {
            id: data.id,
            label: `${formatSnapshotDateRu(data.timestamp)} (${data.totalGamesScanned} игр)`,
          },
        ], data.id);
      }
    } else {
      await this.tryStaticSnapshotFallback(statusDot, statusText);
    }

    this.applySnapshotDataToUI();
  }

  private async tryStaticSnapshotFallback(
    statusDot: HTMLElement | null,
    statusText: HTMLElement | null
  ): Promise<void> {
    const staticData = await fetchStaticSnapshot();
    if (staticData) {
      this.snapshot = staticData;
      statusDot?.classList.remove('offline');
      if (statusText) statusText.textContent = 'GitHub Pages (Статика)';
      this.headerStatusBar?.setSseStatus(true, 'Статика');
      return;
    }

    statusDot?.classList.add('offline');
    if (statusText) statusText.textContent = 'Демонстрационный режим';
    this.headerStatusBar?.setSseStatus(false, 'Оффлайн');
  }

  private setupLiveEventService(): void {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('server-status-text');

    // 1. Статус подключения (connecting, connected, reconnecting, disconnected)
    liveEventService.onStatusChange(status => {
      this.headerStatusBar?.setSseStatus(status);
      if (status === 'connected') {
        statusDot?.classList.remove('offline');
        if (statusText) statusText.textContent = 'HTTP :4200 (SSE Live)';
      } else if (status === 'reconnecting') {
        statusDot?.classList.add('offline');
        if (statusText) statusText.textContent = 'Реконнект к SSE...';
      } else {
        statusDot?.classList.add('offline');
        if (statusText) statusText.textContent = 'Демонстрационный режим';
      }
    });

    // 2. Старт сканирования
    liveEventService.on('scan:started', () => {
      this.isScanning = true;
      this.headerStatusBar?.setScanning(true);
      this.headerStatusBar?.setScanProgress({ pct: 5, label: 'Инициализация мониторинга...' });
      // Фоновый автоскан не должен блокировать экран всем зрителям — оверлей только у инициатора
      if (this.localScanRequested) {
        document.getElementById('scan-overlay')?.classList.add('active');
      }
      const btnScan = document.getElementById('btn-live-scan') as HTMLButtonElement | null;
      if (btnScan) btnScan.disabled = true;
    });

    // Скан отклонён валидацией или упал — снимаем блокировки и объясняем причину
    liveEventService.on('scan:failed', (data: { error?: string }) => {
      this.localScanRequested = false;
      this.resetScanningState();
      this.showToast(data?.error || 'Сканирование не удалось. Прежние данные сохранены.');
    });

    // 3. Реальный прогресс сбора данных
    liveEventService.on('scan:progress', (data: ScanProgressData) => {
      this.headerStatusBar?.setScanProgress(data);
    });

    // 4. Завершение сканирования
    liveEventService.on('scan:completed', async (data: ScanCompletedData) => {
      soundService.playScanFinish();
      this.localScanRequested = false;

      const overlay = document.getElementById('scan-overlay');
      overlay?.classList.remove('active');

      const btnScan = document.getElementById('btn-live-scan') as HTMLButtonElement | null;
      if (btnScan) btnScan.disabled = false;

      this.isScanning = false;
      this.headerStatusBar?.setScanning(false);
      this.headerStatusBar?.setScanProgress(null);

      this.showToast('Сканирование завершено! Снимок обновлен.');

      // Автоматически обновляем срезы и применяем свежие данные ко всем вкладкам
      await this.fetchSnapshots();
      if (data.snapshotId) {
        await this.selectSnapshot(data.snapshotId, false);
      } else {
        await this.fetchLatestSnapshot();
      }
    });

    // 5. Фоновое обновление снимка рынка (cron / другой клиент)
    liveEventService.on('snapshot:updated', async data => {
      if (!this.isScanning) {
        await this.fetchSnapshots();
        if (data.snapshotId && data.snapshotId !== this.currentSnapshotId) {
          await this.selectSnapshot(data.snapshotId, false);
        }
      }
    });

    liveEventService.connect();
  }

  private async triggerLiveScan(): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;
    this.headerStatusBar?.setScanning(true);

    const overlay = document.getElementById('scan-overlay');
    const btnScan = document.getElementById('btn-live-scan') as HTMLButtonElement | null;

    if (btnScan) btnScan.disabled = true;
    overlay?.classList.add('active');

    this.headerStatusBar?.setScanProgress({ pct: 5, label: 'Инициализация мониторинга...' });

    this.localScanRequested = true;
    try {
      const result = await requestScan();
      if (result.kind === 'unauthorized') {
        const entered = window.prompt('Для запуска скана нужен токен доступа (SCAN_TOKEN):');
        storeScanToken(entered);
        this.showToast(entered ? 'Токен сохранён — нажмите «Запустить скан» ещё раз.' : 'Нужен токен доступа.');
        this.localScanRequested = false;
        this.resetScanningState();
      } else if (result.kind === 'disabled') {
        this.showToast('Ручной скан отключён на сервере. Данные обновляются автосканом.');
        this.localScanRequested = false;
        this.resetScanningState();
      } else if (result.kind === 'cooldown') {
        this.showToast(`Скан недавно выполнялся. Повторите через ${result.retryAfterSec} с.`);
        this.localScanRequested = false;
        this.resetScanningState();
      } else if (result.kind === 'error') {
        this.showToast('Сервер вернул ошибку при сканировании.');
        this.localScanRequested = false;
        this.resetScanningState();
      }
      // Ход и завершение транслируются через SSE (scan:progress, scan:completed, scan:failed)
    } catch (err) {
      console.warn('[App] Ошибка запуска POST /api/scan:', err);
      this.showToast('Сервер недоступен для запуска сканирования.');
      this.localScanRequested = false;
      this.resetScanningState();
    }
  }

  private resetScanningState(): void {
    const overlay = document.getElementById('scan-overlay');
    const btnScan = document.getElementById('btn-live-scan') as HTMLButtonElement | null;
    overlay?.classList.remove('active');
    if (btnScan) btnScan.disabled = false;
    this.isScanning = false;
    this.headerStatusBar?.setScanning(false);
    this.headerStatusBar?.setScanProgress(null);
  }

  private updateGlobalMetrics(): void {
    const totalGamesEl = document.getElementById('metric-total-games');
    const totalCcuEl = document.getElementById('metric-total-ccu');
    const topScoreEl = document.getElementById('metric-top-score');
    const topGenreEl = document.getElementById('metric-top-genre');
    const arbitrageCountEl = document.getElementById('metric-arbitrage-count');
    const platformsHintEl = document.getElementById('metric-platforms-hint');

    // База для % изменения CCU — реальный снимок, показанный ДО этого обновления
    const baselineIsReal = this.metricsSnapshotId !== null && this.metricsSnapshotId !== FALLBACK_SNAPSHOT.id;
    const m = computeMarketMetrics(this.snapshot, this.previousSnapshot, baselineIsReal ? this.prevMetrics.totalCcu : 0);
    this.metricsSnapshotId = this.snapshot.id;
    if (topGenreEl && m.topGenreTitle !== null) {
      topGenreEl.textContent = m.topGenreTitle;
    }

    const first = !this.metricsInitialized;
    const from = first
      ? { totalGames: m.totalGames, totalCcu: m.totalCcu, topScore: m.topScore, arbitrageCount: m.arbitrageCount }
      : this.prevMetrics;
    this.metricsInitialized = true;

    if (totalGamesEl) {
      animateCounter(totalGamesEl, from.totalGames, m.totalGames, 1000, val => Math.round(val).toLocaleString());
    }
    if (totalCcuEl) {
      animateCounter(totalCcuEl, from.totalCcu, m.totalCcu, 1000, val => formatCompactNumber(val));
    }
    if (topScoreEl) {
      animateCounter(topScoreEl, from.topScore, m.topScore, 1000, val => `${Math.round(val)}/100`);
    }
    if (arbitrageCountEl) {
      animateCounter(arbitrageCountEl, from.arbitrageCount, m.arbitrageCount, 1000, val => Math.round(val).toString());
    }
    if (platformsHintEl) {
      platformsHintEl.textContent = m.platformsHint;
    }

    this.prevMetrics = {
      totalGames: m.totalGames,
      totalCcu: m.totalCcu,
      topScore: m.topScore,
      arbitrageCount: m.arbitrageCount,
    };

    this.updateCatalogCountUI();
    this.updateArbitrageCountUI();
    this.triggerMetricCardsPulse();

    this.headerStatusBar?.updateKpi({
      totalGames: m.totalGames,
      totalCcu: m.totalCcu,
      ccuChangePercent: m.ccuChangePercent,
      arbitrageCount: m.arbitrageCount,
      topDayGameTitle: m.topGameTitle,
      updatedText: formatMinutesAgo(this.snapshot.timestamp),
    });
    this.refreshFreshness();
  }

  /** Обновляет «N мин назад» и подсвечивает устаревшие данные (старше 3 ч). */
  private refreshFreshness(): void {
    const el = document.getElementById('kpi-updated-time');
    const ts = Date.parse(this.snapshot?.timestamp ?? '');
    if (!el || !Number.isFinite(ts)) return;
    el.textContent = formatMinutesAgo(this.snapshot.timestamp);
    const stale = Date.now() - ts > 3 * 3600_000;
    el.classList.toggle('is-stale', stale);
    el.title = stale ? 'Данные устарели — снимок рынка давно не обновлялся' : '';
  }

  private triggerMetricCardsPulse(): void {
    const cards = document.querySelectorAll<HTMLElement>('.metrics-grid .metric-card');
    cards.forEach(card => {
      card.classList.remove('glow-pulse');
      void card.offsetWidth;
      card.classList.add('glow-pulse');
    });
  }

  private renderLegend(): void {
    const legendContainer = document.getElementById('radar-legend-container');
    if (!legendContainer) return;

    legendContainer.innerHTML = '';

    this.snapshot.verdicts.forEach(v => {
      const item = document.createElement('div');
      item.className = 'legend-item' + (this.activeArchetype === v.archetype ? ' active' : '');

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
        this.activeArchetype = this.activeArchetype === v.archetype ? null : v.archetype;
        if (this.activeArchetype) {
          soundService.playRadarPing();
          this.openArchetypeDetail(this.activeArchetype);
        } else {
          soundService.playClick();
        }
        this.radarChart.updateData(this.getFilteredVerdicts(), this.activeArchetype);
        this.applyFiltersAndSort();
        this.renderLegend();
      });

      legendContainer.appendChild(item);
    });
  }

  private getFilteredVerdicts(): MarketVerdict[] {
    return (this.snapshot.verdicts || []).filter(v => {
      // 1. Archetype selection filter
      if (this.activeArchetype && v.archetype !== this.activeArchetype) {
        return false;
      }

      // 2. Status filter
      if (this.activeStatus !== 'all') {
        if (this.activeStatus === 'arbitrage') {
          if (!v.hasArbitrageOpportunity) return false;
        } else if (v.status !== this.activeStatus) {
          return false;
        }
      }

      // 3. Platform filter: check if verdict has games matching platform
      if (this.activePlatform !== 'all') {
        const platformGames = (this.snapshot.games || []).filter(
          g => g.platform === this.activePlatform && g.archetype === v.archetype
        );
        // Also allow if verdict sampleTitles has matches or if platform counts match
        if (platformGames.length === 0 && this.activePlatform !== 'roblox') {
          // Allow fallback pass if it matches archetype
          const hasSamples = v.sampleTitles.some(t => t.length > 0);
          if (!hasSamples) return false;
        }
      }

      // 4. Search query & dynamic tags
      if (this.searchQuery) {
        if (!verdictMatchesQuery(v, this.searchQuery, this.snapshot.games || [])) {
          return false;
        }
      }

      return true;
    });
  }

  private applyFiltersAndSort(): void {
    const filtered = this.getFilteredVerdicts();

    // Sort filtered verdicts
    filtered.sort((a, b) => {
      switch (this.sortBy) {
        case 'score_desc':
          return b.opportunityScore.overallScore - a.opportunityScore.overallScore;
        case 'score_asc':
          return a.opportunityScore.overallScore - b.opportunityScore.overallScore;
        case 'ccu_desc':
          return b.totalAudienceCCU - a.totalAudienceCCU;
        case 'velocity_desc':
          return b.opportunityScore.velocityScore - a.opportunityScore.velocityScore;
        case 'title_asc':
          return a.titleRu.localeCompare(b.titleRu, 'ru');
        default:
          return 0;
      }
    });

    const countText = document.getElementById('verdicts-count-text');
    if (countText) {
      countText.textContent = `Отображается ${filtered.length} из ${this.snapshot.verdicts?.length || 0}`;
    }

    if (this.radarOverviewView) {
      this.radarOverviewView.updateData(filtered, this.previousSnapshot?.verdicts, this.activeArchetype);
    } else {
      this.verdictCards?.updateData(filtered, this.previousSnapshot?.verdicts);
    }
    this.enhanceVerdictCardsWithPromptButton();
  }

  public openPromptModalForArchetype(archetype: GameArchetype): void {
    const verdict = (this.snapshot.verdicts || []).find(v => v.archetype === archetype);
    const games = this.getGamesForArchetype(archetype);
    const arbitrage = (this.snapshot.arbitrageOpportunities || []).find(
      o => o.archetype === archetype
    );
    soundService.playClick();
    this.promptModal.open(verdict, games, arbitrage);
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

  private injectDrawerPromptButton(verdict: MarketVerdict): void {
    this.currentDrawerVerdict = verdict;
    const footerActions = document.querySelector<HTMLElement>('#game-drawer .drawer-footer-actions');
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

  private showToast(message: string): void {
    const toast = document.getElementById('toast-notification');
    const toastText = document.getElementById('toast-text');
    if (!toast || !toastText) return;

    toastText.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
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

      const isActive = isTagActive(tag, this.searchQuery);
      if (isActive) {
        chip.classList.add('active');
      }

      const matchCount = countGamesForTag(tag, this.snapshot);
      const countBadge = matchCount > 0 ? `<span class="search-tag-count">${matchCount}</span>` : '';

      chip.innerHTML = `
        <span class="search-tag-text">${escapeHtml(tag.label)}</span>
        ${countBadge}
      `;

      chip.addEventListener('click', () => {
        const searchInput = document.getElementById('search-input') as HTMLInputElement;
        const searchClearBtn = document.getElementById('search-clear-btn');
        soundService.playClick();

        if (isTagActive(tag, this.searchQuery)) {
          // Toggle off if currently active
          if (searchInput) searchInput.value = '';
          this.searchQuery = '';
          if (searchClearBtn) searchClearBtn.classList.remove('visible');
        } else {
          // Apply tag filter
          if (searchInput) searchInput.value = tag.label;
          this.searchQuery = tag.query.toLowerCase();
          if (searchClearBtn) searchClearBtn.classList.add('visible');
        }

        this.updateActiveSearchTagUI();
        this.radarChart?.updateData(this.getFilteredVerdicts(), this.activeArchetype);
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
      chip.classList.toggle('active', isTagActive(tag, this.searchQuery));
    });
  }

}

// Instantiate on DOM ready in browser
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    new App();
  });
}
