/**
 * Вкладка «Радар»: радар архетипов + карточки вердиктов (`RadarOverviewView`), легенда,
 * фильтры витрин/статусов, сортировка и поиск. Вкладка открыта при старте — монтируется сразу.
 */
import { MarketVerdict, GameArchetype } from '../../types.js';
import { RadarChartComponent } from '../../components/RadarChart.js';
import { VerdictCardsComponent } from '../../components/VerdictCards.js';
import { RadarOverviewViewComponent } from '../../components/RadarOverviewView.js';
import { soundService } from '../../services/sound.js';
import { escapeHtml, pickOption } from '../../utils/dom.js';
import type { AppState } from '../state.js';
import type { DrawerController } from '../drawerController.js';
import { VERDICT_SORTS, STATUS_FILTERS, PLATFORM_FILTERS, filterVerdicts, sortVerdicts } from '../verdictFilters.js';
import { RadarSearch } from './radarSearch.js';
import { mountRadarLegacyLayout } from './radarLegacyLayout.js';
import type { Workspace } from './workspace.js';

export interface RadarWorkspaceDeps {
  state: AppState;
  drawer: Pick<DrawerController, 'openArchetypeDetail' | 'openGameDetail' | 'openPromptModalForArchetype'>;
}

export class RadarWorkspace implements Workspace {
  readonly search: RadarSearch;
  private radarOverviewView?: RadarOverviewViewComponent;
  private radarChart!: RadarChartComponent;
  private verdictCards!: VerdictCardsComponent;

  constructor(private readonly deps: RadarWorkspaceDeps) {
    this.search = new RadarSearch({
      state: deps.state,
      onChange: () => {
        this.refreshChart();
        this.applyFiltersAndSort();
      },
    });
  }

  /** Переключатели вида радара, поиск, сортировка, фильтры витрин и статусов. */
  bindControls(): void {
    const { state } = this.deps;
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

    this.search.bind();

    // Sort select
    const sortSelect = document.getElementById('sort-select') as HTMLSelectElement;
    sortSelect?.addEventListener('change', e => {
      state.filters.sortBy = pickOption((e.target as HTMLSelectElement).value, VERDICT_SORTS) ?? 'score_desc';
      soundService.playClick();
      this.applyFiltersAndSort();
    });

    // Platform filter pills
    const platformPills = document.querySelectorAll<HTMLButtonElement>('[data-platform]');
    platformPills.forEach(pill => {
      pill.addEventListener('click', () => {
        platformPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.filters.platform = pickOption(pill.getAttribute('data-platform'), PLATFORM_FILTERS) ?? 'all';
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
        state.filters.status = pickOption(pill.getAttribute('data-status'), STATUS_FILTERS) ?? 'all';
        soundService.playClick();
        this.applyFiltersAndSort();
      });
    });
  }

  mount(): void {
    const { state, drawer } = this.deps;
    const radarOverviewContainer = document.getElementById('radar-overview-container');
    if (!radarOverviewContainer) {
      const legacy = mountRadarLegacyLayout({
        state,
        drawer,
        getFilteredVerdicts: () => this.getFilteredVerdicts(),
        onSelectArchetype: archetype => this.selectArchetype(archetype),
        onSelectTag: tag => this.applyCardTag(tag),
      });
      if (legacy.radarChart) this.radarChart = legacy.radarChart;
      if (legacy.verdictCards) this.verdictCards = legacy.verdictCards;
      return;
    }

    this.radarOverviewView = new RadarOverviewViewComponent({
      container: radarOverviewContainer,
      verdicts: this.getFilteredVerdicts(),
      previousVerdicts: state.baseSnapshot?.verdicts,
      activeArchetype: state.filters.archetype,
      onSelectArchetype: archetype => this.selectArchetype(archetype),
      onHoverArchetype: archetype => {
        if (archetype) {
          this.radarOverviewView?.highlightArchetype(archetype, true);
        } else if (!state.filters.archetype) {
          this.verdictCards?.clearHighlight();
        }
      },
      onCardClick: archetype => {
        drawer.openArchetypeDetail(archetype);
      },
      onGeneratePrompt: archetype => {
        drawer.openPromptModalForArchetype(archetype);
      },
      onSelectTag: tag => this.applyCardTag(tag),
      onSelectGame: (title, archetype) => {
        drawer.openGameDetail(title, archetype);
      },
      onModeChange: () => {
        soundService.playClick();
      },
    });

    this.radarChart = this.radarOverviewView.radarChart;
    this.verdictCards = this.radarOverviewView.verdictCards;

    const radarContainer = document.getElementById('radar-chart-container');
    radarContainer?.addEventListener('click', e => {
      const target = e.target as SVGElement;
      const blip = target.closest('.radar-blip-group, .polar-blip-group') as SVGElement;
      if (blip && state.filters.archetype) {
        drawer.openArchetypeDetail(state.filters.archetype);
      }
    });
  }

  /** Первичная отрисовка: кнопки ТЗ на карточках, легенда, чипсы поиска. */
  renderInitial(): void {
    this.enhanceVerdictCardsWithPromptButton();
    this.renderLegend();
    this.search.renderSearchTags();
  }

  show(): void {
    // Радар смонтирован при старте
  }

  update(): void {
    const { state } = this.deps;
    this.renderLegend();
    this.search.renderSearchTags();
    this.radarChart?.updateData(state.snapshot.verdicts, state.filters.archetype);
    this.applyFiltersAndSort();
  }

  /** Сигнал тикера / «Показать на радаре» в drawer'е: запрос, архетип, сброс витрины и статуса. */
  applyFilterFromSignal(query: string, archetype?: GameArchetype): void {
    const { state } = this.deps;
    this.search.setQuery(query);
    if (archetype) {
      state.filters.archetype = archetype;
    }

    // Reset status and platform filters to 'all' so matching game/verdict is visible
    state.filters.platform = 'all';
    state.filters.status = 'all';
    const platformPills = document.querySelectorAll<HTMLButtonElement>('[data-platform]');
    platformPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-platform') === 'all'));
    const statusPills = document.querySelectorAll<HTMLButtonElement>('[data-status]');
    statusPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-status') === 'all'));

    this.search.updateActiveSearchTagUI();
    this.refreshChart();
    this.applyFiltersAndSort();
    this.renderLegend();
  }

  /** Esc: сброс поиска и выбранного архетипа (фильтры витрин и статусов остаются). */
  resetSearch(): void {
    const { state } = this.deps;
    state.filters.searchQuery = '';
    state.filters.archetype = null;
    this.search.updateActiveSearchTagUI();
    this.radarChart?.updateData(this.getFilteredVerdicts(), null);
    this.applyFiltersAndSort();
    this.renderLegend();
  }

  /** Клик по архетипу на радаре или в легенде; null — снять выбор. */
  private selectArchetype(archetype: GameArchetype | null): void {
    this.deps.state.filters.archetype = archetype;
    if (archetype) {
      soundService.playRadarPing();
      this.deps.drawer.openArchetypeDetail(archetype);
    } else {
      soundService.playClick();
    }
    this.radarChart.updateData(this.getFilteredVerdicts(), this.deps.state.filters.archetype);
    this.applyFiltersAndSort();
    this.renderLegend();
  }

  private applyCardTag(tag: string): void {
    soundService.playClick();
    if (this.search.setQueryFromCardTag(tag)) {
      this.applyFiltersAndSort();
    }
  }

  private refreshChart(): void {
    this.radarChart?.updateData(this.getFilteredVerdicts(), this.deps.state.filters.archetype);
  }

  private renderLegend(): void {
    const { state } = this.deps;
    const legendContainer = document.getElementById('radar-legend-container');
    if (!legendContainer) return;

    legendContainer.innerHTML = '';

    state.snapshot.verdicts.forEach(v => {
      const item = document.createElement('div');
      item.className = 'legend-item' + (state.filters.archetype === v.archetype ? ' active' : '');

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
        this.selectArchetype(state.filters.archetype === v.archetype ? null : v.archetype);
      });

      legendContainer.appendChild(item);
    });
  }

  private getFilteredVerdicts(): MarketVerdict[] {
    return filterVerdicts(this.deps.state.snapshot, this.deps.state.filters);
  }

  private applyFiltersAndSort(): void {
    const { state } = this.deps;
    const filtered = this.getFilteredVerdicts();

    sortVerdicts(filtered, state.filters.sortBy);

    const countText = document.getElementById('verdicts-count-text');
    if (countText) {
      countText.textContent = `Отображается ${filtered.length} из ${state.snapshot.verdicts?.length || 0}`;
    }

    if (this.radarOverviewView) {
      this.radarOverviewView.updateData(filtered, state.baseSnapshot?.verdicts, state.filters.archetype);
    } else {
      this.verdictCards?.updateData(filtered, state.baseSnapshot?.verdicts);
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
}
