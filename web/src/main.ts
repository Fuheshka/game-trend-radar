import { MarketSnapshot, MarketVerdict, GameArchetype, PlatformType, NormalizedGame, SnapshotSummary } from './types.js';
import { FALLBACK_SNAPSHOT } from './fallbackData.js';
import { RadarChartComponent, ChartMode } from './components/RadarChart.js';
import { VerdictCardsComponent } from './components/VerdictCards.js';
import { LiveTickerComponent, TickerSignal } from './components/LiveTicker.js';
import { DetailDrawerComponent } from './components/DetailDrawer.js';
import { GameCatalogComponent, CatalogViewMode, CatalogSortBy } from './components/GameCatalog.js';
import { ArbitrageMatrixComponent } from './components/ArbitrageMatrix.js';
import { PromptGeneratorModalComponent } from './components/PromptGeneratorModal.js';
import { animateCounter } from './utils/animation.js';
import { soundService } from './services/sound.js';
import {
  exportSnapshotToMarkdown,
  exportSnapshotToJson,
  generateExportFilename,
  downloadBlob,
} from './services/exporter.js';

export interface PopularSearchTag {
  id: string;
  label: string;
  query: string;
}

export const POPULAR_SEARCH_TAGS: PopularSearchTag[] = [
  { id: 'simulators', label: 'Симуляторы', query: 'симулятор' },
  { id: 'horror', label: 'Хоррор', query: 'хоррор' },
  { id: 'obby', label: 'Обби', query: 'обби' },
  { id: 'puzzles', label: 'Головоломки', query: 'головоломк' },
  { id: 'sandbox', label: 'Песочница', query: 'песочниц' },
  { id: 'clickers', label: 'Кликеры', query: 'кликер' },
  { id: 'shorts', label: 'Мемы Shorts', query: 'shorts' },
  { id: 'merge', label: 'Мёрдж', query: 'мёрдж' },
  { id: 'shooters', label: 'Шутеры', query: 'шутер' },
  { id: 'tycoons', label: 'Тайкуны', query: 'тайкун' },
  { id: 'ragdoll', label: 'Рэгдолл', query: 'рэгдолл' },
];

export function formatSnapshotDateRu(dateStr: string): string {
  const dateOnly = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = dateOnly.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[2], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const monthsRu = [
      'янв', 'фев', 'мар', 'апр', 'май', 'июн',
      'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'
    ];
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${day} ${monthsRu[monthIndex]}`;
    }
  }
  return dateStr;
}

class App {
  private snapshot: MarketSnapshot = FALLBACK_SNAPSHOT;
  private snapshotsList: SnapshotSummary[] = [];
  private snapshotsCache: Map<string, MarketSnapshot> = new Map();
  private currentSnapshotId: string = '';
  private previousSnapshot: MarketSnapshot | null = null;
  private activePlatform: 'all' | PlatformType = 'all';
  private activeStatus: 'all' | 'GREEN_LIGHT' | 'YELLOW_LIGHT' | 'RED_LIGHT' | 'arbitrage' = 'all';
  private activeArchetype: GameArchetype | null = null;
  private searchQuery: string = '';
  private sortBy: 'score_desc' | 'score_asc' | 'ccu_desc' | 'velocity_desc' | 'title_asc' = 'score_desc';
  private isScanning: boolean = false;
  private currentView: 'niches' | 'catalog' | 'arbitrage' = 'niches';
  private prevMetrics = {
    totalGames: 0,
    totalCcu: 0,
    topScore: 0,
    arbitrageCount: 0,
  };

  private radarChart!: RadarChartComponent;
  private verdictCards!: VerdictCardsComponent;
  private liveTicker!: LiveTickerComponent;
  private detailDrawer!: DetailDrawerComponent;
  private gameCatalog!: GameCatalogComponent;
  private arbitrageMatrix!: ArbitrageMatrixComponent;
  private promptModal!: PromptGeneratorModalComponent;
  private currentDrawerVerdict: MarketVerdict | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.initElements();
    this.initShortcuts();

    // Initial render with fallback data while fetching live snapshot
    this.setupComponents();
    this.enhanceVerdictCardsWithPromptButton();
    this.updateGlobalMetrics();
    this.renderLegend();
    this.renderSearchTags();

    // Fetch live snapshots list & data from backend
    await this.fetchSnapshots();
  }

  private initElements(): void {
    // Snapshot history selector
    const snapshotSelect = document.getElementById('snapshot-select') as HTMLSelectElement | null;
    snapshotSelect?.addEventListener('change', async e => {
      const selectedId = (e.target as HTMLSelectElement).value;
      soundService.playClick();
      await this.selectSnapshot(selectedId, true);
    });

    // Sound toggle button
    const btnSoundToggle = document.getElementById('btn-sound-toggle');
    const soundToggleLabel = document.getElementById('sound-toggle-label');

    const updateSoundUI = (muted: boolean) => {
      btnSoundToggle?.classList.toggle('active', !muted);
      if (soundToggleLabel) {
        soundToggleLabel.textContent = muted ? 'Mute' : 'Sound On';
      }
    };

    updateSoundUI(soundService.isMuted());

    btnSoundToggle?.addEventListener('click', () => {
      const isMuted = soundService.toggleMute();
      updateSoundUI(isMuted);
      if (!isMuted) {
        soundService.playClick();
      }
    });

    // Mode toggles for Radar Chart
    const toggleSpider = document.getElementById('toggle-spider');
    const togglePolar = document.getElementById('toggle-polar');

    toggleSpider?.addEventListener('click', () => {
      toggleSpider.classList.add('active');
      togglePolar?.classList.remove('active');
      this.radarChart.setMode('spider');
      soundService.playClick();
    });

    togglePolar?.addEventListener('click', () => {
      togglePolar.classList.add('active');
      toggleSpider?.classList.remove('active');
      this.radarChart.setMode('polar');
      soundService.playClick();
    });

    // Scan button
    const btnScan = document.getElementById('btn-live-scan');
    btnScan?.addEventListener('click', () => {
      soundService.playClick();
      this.triggerLiveScan();
    });

    // Export dropdown button and options
    const exportDropdownWrapper = document.getElementById('export-dropdown-wrapper');
    const btnExportDropdown = document.getElementById('btn-export-dropdown');
    const btnExportMd = document.getElementById('btn-export-md');
    const btnExportJson = document.getElementById('btn-export-json');

    const closeExportDropdown = () => {
      exportDropdownWrapper?.classList.remove('open');
      btnExportDropdown?.setAttribute('aria-expanded', 'false');
    };

    btnExportDropdown?.addEventListener('click', e => {
      e.stopPropagation();
      soundService.playClick();
      const isOpen = exportDropdownWrapper?.classList.toggle('open');
      btnExportDropdown.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    document.addEventListener('click', e => {
      if (exportDropdownWrapper && !exportDropdownWrapper.contains(e.target as Node)) {
        closeExportDropdown();
      }
    });

    btnExportMd?.addEventListener('click', () => {
      soundService.playClick();
      closeExportDropdown();
      const md = exportSnapshotToMarkdown(this.snapshot);
      const filename = generateExportFilename(this.snapshot, 'md');
      downloadBlob(md, filename, 'text/markdown;charset=utf-8');
    });

    btnExportJson?.addEventListener('click', () => {
      soundService.playClick();
      closeExportDropdown();
      const json = exportSnapshotToJson(this.snapshot);
      const filename = generateExportFilename(this.snapshot, 'json');
      downloadBlob(json, filename, 'application/json;charset=utf-8');
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
      this.sortBy = (e.target as HTMLSelectElement).value as any;
      soundService.playClick();
      this.applyFiltersAndSort();
    });

    // Platform filter pills
    const platformPills = document.querySelectorAll<HTMLButtonElement>('[data-platform]');
    platformPills.forEach(pill => {
      pill.addEventListener('click', () => {
        platformPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activePlatform = pill.getAttribute('data-platform') as any;
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
        this.activeStatus = pill.getAttribute('data-status') as any;
        soundService.playClick();
        this.applyFiltersAndSort();
      });
    });

    // Main View Mode Tabs
    const tabBtnNiches = document.getElementById('tab-btn-niches');
    const tabBtnCatalog = document.getElementById('tab-btn-catalog');
    const tabBtnArbitrage = document.getElementById('tab-btn-arbitrage');
    tabBtnNiches?.addEventListener('click', () => {
      this.switchView('niches');
      soundService.playClick();
    });
    tabBtnCatalog?.addEventListener('click', () => {
      this.switchView('catalog');
      soundService.playClick();
    });
    tabBtnArbitrage?.addEventListener('click', () => {
      this.switchView('arbitrage');
      soundService.playClick();
    });

    // Global Metric Card: Arbitrage shortcut click
    const metricArbitrageCard = document.querySelector('.metric-card.orange');
    metricArbitrageCard?.addEventListener('click', () => {
      this.switchView('arbitrage');
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
      if (this.gameCatalog) {
        this.gameCatalog.setMinCcu(val);
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
      if (this.gameCatalog) {
        this.gameCatalog.setSearchQuery(query);
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
      if (this.gameCatalog) {
        this.gameCatalog.setSearchQuery('');
        this.updateCatalogCountUI();
      }
    });

    // Catalog Platform Filter Pills
    const catalogPlatformPills = document.querySelectorAll<HTMLButtonElement>('[data-catalog-platform]');
    catalogPlatformPills.forEach(pill => {
      pill.addEventListener('click', () => {
        catalogPlatformPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const platform = pill.getAttribute('data-catalog-platform') as any;
        soundService.playClick();
        if (this.gameCatalog) {
          this.gameCatalog.setPlatform(platform);
          this.updateCatalogCountUI();
        }
      });
    });

    // Catalog Sort Select
    const catalogSortSelect = document.getElementById('catalog-sort-select') as HTMLSelectElement;
    catalogSortSelect?.addEventListener('change', e => {
      const sort = (e.target as HTMLSelectElement).value as any;
      soundService.playClick();
      if (this.gameCatalog) {
        this.gameCatalog.setSort(sort);
      }
    });

    // Catalog View Mode Toggles (Grid / Table)
    const btnViewGrid = document.getElementById('btn-view-grid');
    const btnViewTable = document.getElementById('btn-view-table');

    btnViewGrid?.addEventListener('click', () => {
      btnViewGrid.classList.add('active');
      btnViewTable?.classList.remove('active');
      soundService.playClick();
      this.gameCatalog?.setViewMode('grid');
    });

    btnViewTable?.addEventListener('click', () => {
      btnViewTable.classList.add('active');
      btnViewGrid?.classList.remove('active');
      soundService.playClick();
      this.gameCatalog?.setViewMode('table');
    });
  }

  private initShortcuts(): void {
    window.addEventListener('keydown', e => {
      // Cmd/Ctrl + K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('search-input') as HTMLInputElement;
        searchInput?.focus();
      }

      // Escape to reset filters & clear search
      if (e.key === 'Escape') {
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
        this.radarChart.updateData(this.getFilteredVerdicts(), null);
        this.applyFiltersAndSort();
        this.renderLegend();
        if (this.gameCatalog) {
          this.gameCatalog.setSearchQuery('');
          this.updateCatalogCountUI();
        }
      }
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

    if (tickerTrack) {
      this.liveTicker = new LiveTickerComponent({
        container: tickerTrack,
        snapshot: this.snapshot,
        onSelectSignal: signal => {
          this.handleTickerSignalClick(signal);
        },
      });
    }

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
          // If a blip was clicked, open the detail drawer for the active archetype or determine from blip
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

    // Game Catalog Component setup
    const catalogContainer = document.getElementById('catalog-container');
    if (catalogContainer) {
      this.gameCatalog = new GameCatalogComponent({
        container: catalogContainer,
        games: this.snapshot.games || [],
        onSelectGame: game => {
          soundService.playClick();
          this.detailDrawer.openGame(game, this.snapshot.games);
        },
        onTagClick: tag => {
          soundService.playClick();
          const catalogSearchInput = document.getElementById('catalog-search-input') as HTMLInputElement;
          if (catalogSearchInput) {
            catalogSearchInput.value = tag;
          }
          this.gameCatalog.setSearchQuery(tag);
          this.updateCatalogCountUI();
        },
      });
      this.updateCatalogCountUI();
    }

    // Arbitrage Matrix Component setup
    const arbitrageContainer = document.getElementById('arbitrage-matrix-container');
    if (arbitrageContainer) {
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

    // Prompt Generator Modal Component setup
    this.promptModal = new PromptGeneratorModalComponent({
      showToast: msg => this.showToast(msg),
      onClose: () => soundService.playClick(),
    });
  }

  private switchView(view: 'niches' | 'catalog' | 'arbitrage'): void {
    if (this.currentView === view) return;
    this.currentView = view;

    const tabNiches = document.getElementById('tab-btn-niches');
    const tabCatalog = document.getElementById('tab-btn-catalog');
    const tabArbitrage = document.getElementById('tab-btn-arbitrage');
    const panelNiches = document.getElementById('niches-view-panel');
    const panelCatalog = document.getElementById('catalog-view-panel');
    const panelArbitrage = document.getElementById('arbitrage-view-panel');

    tabNiches?.classList.toggle('active', view === 'niches');
    tabCatalog?.classList.toggle('active', view === 'catalog');
    tabArbitrage?.classList.toggle('active', view === 'arbitrage');

    if (panelNiches) panelNiches.style.display = view === 'niches' ? 'block' : 'none';
    if (panelCatalog) panelCatalog.style.display = view === 'catalog' ? 'block' : 'none';
    if (panelArbitrage) panelArbitrage.style.display = view === 'arbitrage' ? 'block' : 'none';

    if (view === 'catalog') {
      this.updateCatalogCountUI();
    } else if (view === 'arbitrage') {
      this.updateArbitrageCountUI();
    }
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
    const filtered = this.gameCatalog ? this.gameCatalog.getFilteredCount() : total;

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

    try {
      const res = await fetch('/api/snapshots');
      if (res.ok) {
        const list: SnapshotSummary[] = await res.json();
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
    } catch {
      // Backend unavailable or fetch error, proceed to fallback
    }

    // Fallback: try fetching /api/snapshots/latest or static fallback
    await this.fetchLatestSnapshot();
  }

  private populateSnapshotSelect(): void {
    const select = document.getElementById('snapshot-select') as HTMLSelectElement | null;
    if (!select) return;

    select.innerHTML = '';
    this.snapshotsList.forEach((s, idx) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      const formattedDate = formatSnapshotDateRu(s.date);
      opt.textContent = `${formattedDate} (${s.totalGamesScanned} игр)`;
      if (idx === 0) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
  }

  private async selectSnapshot(snapshotId: string, animate: boolean = true): Promise<void> {
    if (!snapshotId) return;

    const select = document.getElementById('snapshot-select') as HTMLSelectElement | null;
    if (select && select.value !== snapshotId) {
      select.value = snapshotId;
    }

    try {
      let data: MarketSnapshot | undefined = this.snapshotsCache.get(snapshotId);
      if (!data) {
        const res = await fetch(`/api/snapshots/${snapshotId}`);
        if (res.ok) {
          data = await res.json();
          this.snapshotsCache.set(snapshotId, data!);
        }
      }

      if (data) {
        this.snapshot = data;
        this.currentSnapshotId = snapshotId;

        // Find immediately preceding snapshot in history (idx + 1 in date-descending list)
        const currIdx = this.snapshotsList.findIndex(s => s.id === snapshotId);
        if (currIdx >= 0 && currIdx + 1 < this.snapshotsList.length) {
          const prevSummary = this.snapshotsList[currIdx + 1];
          let prevData = this.snapshotsCache.get(prevSummary.id);
          if (!prevData) {
            try {
              const prevRes = await fetch(`/api/snapshots/${prevSummary.id}`);
              if (prevRes.ok) {
                prevData = await prevRes.json();
                this.snapshotsCache.set(prevSummary.id, prevData!);
              }
            } catch {
              // Ignore failure for previous snapshot
            }
          }
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
    this.gameCatalog?.updateData(this.snapshot.games || []);
    this.updateCatalogCountUI();
    this.arbitrageMatrix?.updateData(this.snapshot.arbitrageOpportunities || []);
    this.updateArbitrageCountUI();
    this.applyFiltersAndSort();
  }

  private async fetchLatestSnapshot(): Promise<void> {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('server-status-text');

    try {
      const res = await fetch('/api/snapshots/latest');
      if (res.ok) {
        const data: MarketSnapshot = await res.json();
        this.snapshot = data;
        this.currentSnapshotId = data.id;
        this.snapshotsCache.set(data.id, data);
        statusDot?.classList.remove('offline');
        if (statusText) statusText.textContent = 'HTTP :4200 (Online)';

        // Populate single fallback option if snapshotsList is empty
        const select = document.getElementById('snapshot-select') as HTMLSelectElement | null;
        if (select && select.options.length <= 1) {
          select.innerHTML = '';
          const opt = document.createElement('option');
          opt.value = data.id;
          opt.textContent = `${formatSnapshotDateRu(data.timestamp)} (${data.totalGamesScanned} игр)`;
          opt.selected = true;
          select.appendChild(opt);
        }
      } else {
        await this.tryStaticSnapshotFallback(statusDot, statusText);
      }
    } catch {
      await this.tryStaticSnapshotFallback(statusDot, statusText);
    }

    this.applySnapshotDataToUI();
  }

  private async tryStaticSnapshotFallback(
    statusDot: HTMLElement | null,
    statusText: HTMLElement | null
  ): Promise<void> {
    try {
      const staticRes = await fetch('./data/latest_snapshot.json');
      if (staticRes.ok) {
        const staticData: MarketSnapshot = await staticRes.json();
        this.snapshot = staticData;
        statusDot?.classList.remove('offline');
        if (statusText) statusText.textContent = 'GitHub Pages (Статика)';
        return;
      }
    } catch {
      // Ignore static fetch errors and fallback to hardcoded snapshot
    }

    statusDot?.classList.add('offline');
    if (statusText) statusText.textContent = 'Демонстрационный режим';
  }

  private async triggerLiveScan(): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    const overlay = document.getElementById('scan-overlay');
    const phaseText = document.getElementById('scan-phase-text');
    const progressInner = document.getElementById('scan-progress-inner');
    const btnScan = document.getElementById('btn-live-scan') as HTMLButtonElement;

    if (btnScan) btnScan.disabled = true;
    overlay?.classList.add('active');

    const phases = [
      { text: 'Опрос Roblox Explore API (CCU, лайки и ранги)...', pct: 20 },
      { text: 'Парсинг каталога и промо-блоков Яндекс Игр...', pct: 45 },
      { text: 'Сбор чартов Poki Web Top-100...', pct: 65 },
      { text: 'Детекция вирусных мемов в YouTube Shorts...', pct: 85 },
      { text: 'Расчет Opportunity Score и арбитражных ниш...', pct: 95 },
    ];

    let currentPhase = 0;
    const interval = setInterval(() => {
      if (currentPhase < phases.length) {
        if (phaseText) phaseText.textContent = phases[currentPhase].text;
        if (progressInner) progressInner.style.width = `${phases[currentPhase].pct}%`;
        currentPhase++;
      }
    }, 1200);

    try {
      const res = await fetch('/api/scan', { method: 'POST' });
      clearInterval(interval);

      if (res.ok) {
        const newSnapshot: MarketSnapshot = await res.json();
        this.snapshot = newSnapshot;
        if (progressInner) progressInner.style.width = '100%';
        if (phaseText) phaseText.textContent = 'Сканирование успешно завершено.';
        this.showToast('Сканирование завершено! Снимок обновлен.');
        // Refresh snapshots list to include the newly generated snapshot
        await this.fetchSnapshots();
      } else {
        if (phaseText) phaseText.textContent = 'Сервер вернул ошибку, обновляем данные из кэша.';
        this.showToast('Ошибка внешних API, использован локальный кэш.');
      }
    } catch {
      clearInterval(interval);
      if (progressInner) progressInner.style.width = '100%';
      if (phaseText) phaseText.textContent = 'Сервер недоступен, режим эмуляции завершен.';
      this.showToast('Сервер оффлайн — отображены кэшированные данные.');
    } finally {
      setTimeout(() => {
        overlay?.classList.remove('active');
        if (progressInner) progressInner.style.width = '0%';
        if (btnScan) btnScan.disabled = false;
        this.isScanning = false;

        soundService.playScanFinish();

        this.updateGlobalMetrics();
        this.renderLegend();
        this.renderSearchTags();
        this.liveTicker?.updateData(this.snapshot);
        this.radarChart?.updateData(this.snapshot.verdicts, this.activeArchetype);
        this.gameCatalog?.updateData(this.snapshot.games || []);
        this.updateCatalogCountUI();
        this.arbitrageMatrix?.updateData(this.snapshot.arbitrageOpportunities || []);
        this.updateArbitrageCountUI();
        this.applyFiltersAndSort();
      }, 700);
    }
  }

  private updateGlobalMetrics(): void {
    const totalGamesEl = document.getElementById('metric-total-games');
    const totalCcuEl = document.getElementById('metric-total-ccu');
    const topScoreEl = document.getElementById('metric-top-score');
    const topGenreEl = document.getElementById('metric-top-genre');
    const arbitrageCountEl = document.getElementById('metric-arbitrage-count');
    const platformsHintEl = document.getElementById('metric-platforms-hint');

    const counts = this.snapshot.platformCounts;
    const totalGames = this.snapshot.totalGamesScanned || 0;
    const totalCCU = this.snapshot.robloxTotalCCU || 0;

    const sortedVerdicts = [...(this.snapshot.verdicts || [])].sort(
      (a, b) => b.opportunityScore.overallScore - a.opportunityScore.overallScore
    );

    const topScore = sortedVerdicts.length > 0 ? sortedVerdicts[0].opportunityScore.overallScore : 0;
    if (topGenreEl && sortedVerdicts.length > 0) {
      topGenreEl.textContent = sortedVerdicts[0].titleRu;
    }

    const arbitrageCount =
      this.snapshot.arbitrageOpportunities?.length ??
      this.snapshot.verdicts.filter(v => v.hasArbitrageOpportunity).length;

    if (totalGamesEl) {
      animateCounter(
        totalGamesEl,
        this.prevMetrics.totalGames,
        totalGames,
        1000,
        val => Math.round(val).toLocaleString()
      );
    }

    if (totalCcuEl) {
      animateCounter(
        totalCcuEl,
        this.prevMetrics.totalCcu,
        totalCCU,
        1000,
        val => this.formatNumber(val)
      );
    }

    if (topScoreEl) {
      animateCounter(
        topScoreEl,
        this.prevMetrics.topScore,
        topScore,
        1000,
        val => `${Math.round(val)}/100`
      );
    }

    if (arbitrageCountEl) {
      animateCounter(
        arbitrageCountEl,
        this.prevMetrics.arbitrageCount,
        arbitrageCount,
        1000,
        val => Math.round(val).toString()
      );
    }

    if (platformsHintEl) {
      platformsHintEl.textContent = `Roblox: ${counts.roblox || 0} · Yandex: ${counts.yandex_games || 0} · Poki: ${counts.poki || 0}`;
    }

    this.prevMetrics = {
      totalGames,
      totalCcu: totalCCU,
      topScore,
      arbitrageCount,
    };

    this.updateCatalogCountUI();
    this.updateArbitrageCountUI();
    this.triggerMetricCardsPulse();
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
          <span class="legend-name">${v.titleRu}</span>
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
        if (!this.doesVerdictMatchQuery(v, this.searchQuery)) {
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

    this.verdictCards?.updateData(filtered, this.previousSnapshot?.verdicts);
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

      const isActive = this.isTagActive(tag);
      if (isActive) {
        chip.classList.add('active');
      }

      const matchCount = this.getMatchingCountForTag(tag);
      const countBadge = matchCount > 0 ? `<span class="search-tag-count">${matchCount}</span>` : '';

      chip.innerHTML = `
        <span class="search-tag-text">${tag.label}</span>
        ${countBadge}
      `;

      chip.addEventListener('click', () => {
        const searchInput = document.getElementById('search-input') as HTMLInputElement;
        const searchClearBtn = document.getElementById('search-clear-btn');
        soundService.playClick();

        if (this.isTagActive(tag)) {
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

  private isTagActive(tag: PopularSearchTag): boolean {
    if (!this.searchQuery) return false;
    const q = this.searchQuery.toLowerCase().trim();
    const tQuery = tag.query.toLowerCase();
    const tLabel = tag.label.toLowerCase();
    return q === tQuery || q === tLabel || tLabel.includes(q) || tQuery.includes(q) || q.includes(tQuery);
  }

  private updateActiveSearchTagUI(): void {
    const chips = document.querySelectorAll<HTMLButtonElement>('.search-tag-chip');
    chips.forEach(chip => {
      const q = chip.getAttribute('data-query') || '';
      const label = chip.getAttribute('data-label') || '';
      const tag: PopularSearchTag = { id: chip.getAttribute('data-tag-id') || '', label, query: q };
      chip.classList.toggle('active', this.isTagActive(tag));
    });
  }

  private getMatchingCountForTag(tag: PopularSearchTag): number {
    const q = tag.query.toLowerCase();
    const label = tag.label.toLowerCase();
    const games = this.snapshot.games || [];
    let count = 0;

    for (const g of games) {
      const inTitle = g.title.toLowerCase().includes(q) || g.title.toLowerCase().includes(label);
      const inGenre = (g.genre && (g.genre.toLowerCase().includes(q) || g.genre.toLowerCase().includes(label))) || false;
      const inTags = (g.tags || []).some(t => t.toLowerCase().includes(q) || t.toLowerCase().includes(label));

      let inArch = false;
      if (q === 'симулятор' || q === 'кликер') inArch = g.archetype === 'SIMULATION_INCREMENTAL';
      else if (q === 'хоррор') inArch = g.archetype === 'SURVIVAL_HORROR';
      else if (q === 'обби') inArch = g.archetype === 'OBBY_PARKOUR';
      else if (q === 'головоломк') inArch = g.archetype === 'WORD_PUZZLE';
      else if (q === 'песочниц' || q === 'рэгдолл') inArch = g.archetype === 'PHYSICS_SANDBOX';
      else if (q === 'мёрдж' || q === 'тайкун') inArch = g.archetype === 'MERGE_IDLE';
      else if (q === 'шутер') inArch = g.archetype === 'ACTION_SHOOTER';
      else if (q === 'shorts') inArch = g.platform === 'youtube_trends' || (g.tags && g.tags.some(t => t.toLowerCase().includes('short')));

      if (inTitle || inGenre || inTags || inArch) {
        count++;
      }
    }

    if (count === 0) {
      for (const v of this.snapshot.verdicts || []) {
        if (this.doesVerdictMatchQuery(v, q)) {
          count += Math.max(1, v.sampleTitles.length);
        }
      }
    }

    return count;
  }

  private doesVerdictMatchQuery(v: MarketVerdict, q: string): boolean {
    if (!q) return true;
    const lower = q.toLowerCase().trim();

    // 1. Direct text fields
    if (
      v.titleRu.toLowerCase().includes(lower) ||
      v.archetype.toLowerCase().includes(lower) ||
      v.sampleTitles.some(s => s.toLowerCase().includes(lower)) ||
      v.actionRecommendation.toLowerCase().includes(lower) ||
      v.coreLoopBlueprint.toLowerCase().includes(lower) ||
      v.avoidPitfalls.toLowerCase().includes(lower) ||
      (v.monetizationStrategy && v.monetizationStrategy.toLowerCase().includes(lower))
    ) {
      return true;
    }

    // 2. Archetype keyword mapping (e.g. головоломка -> WORD_PUZZLE, песочница -> PHYSICS_SANDBOX, кликер -> SIMULATION_INCREMENTAL)
    const keywords: Record<GameArchetype, string[]> = {
      SIMULATION_INCREMENTAL: ['симулятор', 'симуляторы', 'эволюция', 'кликер', 'кликеры', 'тайкун', 'тайкуны', 'добыча', 'прокачка'],
      PHYSICS_SANDBOX: ['песочница', 'песочницы', 'сендбокс', 'sandbox', 'рэгдолл', 'ragdoll', 'физика', 'разрушение', 'melon'],
      MERGE_IDLE: ['мёрдж', 'мердж', 'merge', 'сортировка', 'айдл', 'idle', 'тайкун', 'крафт'],
      SURVIVAL_HORROR: ['хоррор', 'хорроры', 'horror', 'побег', 'выживание', 'survival', 'escape', 'doors', 'фредди', 'fnaf'],
      WORD_PUZZLE: ['головоломка', 'головоломки', 'пазл', 'пазлы', 'puzzle', 'слова', 'словесные', 'филворд', 'кроссворд', 'логика', 'викторина'],
      ACTION_SHOOTER: ['шутер', 'шутеры', 'shooter', 'экшен', 'action', 'стрелялка', 'стрелялки', 'оружие', 'standoff'],
      OBBY_PARKOUR: ['обби', 'паркур', 'obby', 'parkour', 'башня', 'прыжки', 'tower'],
      OTHER_CASUAL: ['казуальные', 'casual', 'аркады', 'arcade'],
    };

    const archKeywords = keywords[v.archetype] || [];
    if (archKeywords.some(k => k.includes(lower) || lower.includes(k))) {
      return true;
    }

    // 3. YouTube Shorts / viral meme search
    if (lower.includes('мем') || lower.includes('short') || lower.includes('viral') || lower.includes('вирус')) {
      if (v.opportunityScore?.viralMultiplier && v.opportunityScore.viralMultiplier > 1.0) {
        return true;
      }
      if (
        v.sampleTitles.some(s =>
          s.toLowerCase().includes('brainrot') ||
          s.toLowerCase().includes('egg') ||
          s.toLowerCase().includes('skibidi') ||
          s.toLowerCase().includes('shorts')
        )
      ) {
        return true;
      }
    }

    // 4. Any associated games in this snapshot
    const matchingGames = (this.snapshot.games || []).some(
      g =>
        g.archetype === v.archetype &&
        (g.title.toLowerCase().includes(lower) ||
          (g.genre && g.genre.toLowerCase().includes(lower)) ||
          (g.tags && g.tags.some(t => t.toLowerCase().includes(lower))))
    );
    if (matchingGames) {
      return true;
    }

    return false;
  }

  private formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return Math.round(n).toLocaleString();
  }
}

// Instantiate on DOM ready in browser
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    new App();
  });
}
