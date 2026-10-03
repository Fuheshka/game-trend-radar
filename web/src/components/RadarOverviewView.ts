import { MarketVerdict, GameArchetype } from '../types.js';
import { RadarChartComponent, ChartMode } from './RadarChart.js';
import { VerdictCardsComponent } from './VerdictCards.js';

export interface RadarOverviewViewOptions {
  container: HTMLElement;
  verdicts: MarketVerdict[];
  previousVerdicts?: MarketVerdict[];
  activeArchetype: GameArchetype | null;
  onSelectArchetype?: (archetype: GameArchetype | null) => void;
  onHoverArchetype?: (archetype: GameArchetype | null) => void;
  onGeneratePrompt?: (archetype: GameArchetype) => void;
  onSelectTag?: (tag: string) => void;
  onSelectGame?: (gameTitle: string, archetype?: GameArchetype) => void;
  onCardClick?: (archetype: GameArchetype) => void;
  onModeChange?: (mode: ChartMode) => void;
}

export class RadarOverviewViewComponent {
  private container: HTMLElement;
  private verdicts: MarketVerdict[] = [];
  private previousVerdicts: MarketVerdict[] = [];
  private activeArchetype: GameArchetype | null = null;
  private mode: ChartMode = 'spider';

  private onSelectArchetype?: (archetype: GameArchetype | null) => void;
  private onHoverArchetype?: (archetype: GameArchetype | null) => void;
  private onGeneratePrompt?: (archetype: GameArchetype) => void;
  private onSelectTag?: (tag: string) => void;
  private onSelectGame?: (gameTitle: string, archetype?: GameArchetype) => void;
  private onModeChange?: (mode: ChartMode) => void;

  public radarChart!: RadarChartComponent;
  public verdictCards!: VerdictCardsComponent;

  private splitWrapperEl!: HTMLElement;
  private leftColEl!: HTMLElement;
  private rightColEl!: HTMLElement;
  private radarStageEl!: HTMLElement;
  private verdictsContainerEl!: HTMLElement;
  private legendContainerEl!: HTMLElement;
  private countBadgeEl: HTMLElement | null = null;
  private toggleSpiderBtn!: HTMLElement;
  private togglePolarBtn!: HTMLElement;

  private boundRightColClick: (e: MouseEvent) => void;
  private boundToggleSpiderClick: () => void;
  private boundTogglePolarClick: () => void;

  constructor(options: RadarOverviewViewOptions) {
    this.container = options.container;
    this.verdicts = options.verdicts || [];
    this.previousVerdicts = options.previousVerdicts || [];
    this.activeArchetype = options.activeArchetype;
    this.onSelectArchetype = options.onSelectArchetype;
    this.onHoverArchetype = options.onHoverArchetype;
    this.onGeneratePrompt = options.onGeneratePrompt;
    this.onSelectTag = options.onSelectTag;
    this.onSelectGame = options.onSelectGame;
    this.onCardClick = options.onCardClick;
    this.onModeChange = options.onModeChange;

    this.boundRightColClick = this.handleRightColClick.bind(this);
    this.boundToggleSpiderClick = () => this.setMode('spider');
    this.boundTogglePolarClick = () => this.setMode('polar');

    this.render();
  }

  public setMode(mode: ChartMode): void {
    if (this.mode === mode) return;
    this.mode = mode;

    if (this.toggleSpiderBtn && this.togglePolarBtn) {
      if (mode === 'spider') {
        this.toggleSpiderBtn.classList.add('active');
        this.togglePolarBtn.classList.remove('active');
      } else {
        this.togglePolarBtn.classList.add('active');
        this.toggleSpiderBtn.classList.remove('active');
      }
    }

    if (this.radarChart) {
      this.radarChart.setMode(mode);
    }

    this.onModeChange?.(mode);
  }

  public getMode(): ChartMode {
    return this.mode;
  }

  public onCardClick?: (archetype: GameArchetype) => void;

  public updateData(
    verdicts: MarketVerdict[],
    previousVerdictsOrArchetype?: MarketVerdict[] | GameArchetype | null,
    archetypeOrPreviousVerdicts?: GameArchetype | null | MarketVerdict[]
  ): void {
    this.verdicts = verdicts || [];
    if (Array.isArray(previousVerdictsOrArchetype)) {
      this.previousVerdicts = previousVerdictsOrArchetype;
      if (archetypeOrPreviousVerdicts !== undefined) {
        this.activeArchetype = archetypeOrPreviousVerdicts as GameArchetype | null;
      }
    } else if (previousVerdictsOrArchetype === null || typeof previousVerdictsOrArchetype === 'string') {
      this.activeArchetype = previousVerdictsOrArchetype;
      if (Array.isArray(archetypeOrPreviousVerdicts)) {
        this.previousVerdicts = archetypeOrPreviousVerdicts;
      }
    } else {
      if (Array.isArray(archetypeOrPreviousVerdicts)) {
        this.previousVerdicts = archetypeOrPreviousVerdicts;
      } else if (archetypeOrPreviousVerdicts !== undefined) {
        this.activeArchetype = archetypeOrPreviousVerdicts as GameArchetype | null;
      }
    }

    this.updateCountBadge();
    this.renderLegend();

    if (this.radarChart) {
      this.radarChart.updateData(this.verdicts, this.activeArchetype);
    }
    if (this.verdictCards) {
      this.verdictCards.updateData(this.verdicts, this.previousVerdicts);
    }
  }

  public highlightArchetype(archetype: GameArchetype | null, scrollIntoView = true): void {
    this.scrollToArchetype(archetype);
  }

  public scrollToArchetype(archetype: GameArchetype | null): void {
    if (!archetype) {
      this.verdictCards?.clearHighlight?.();
      return;
    }

    this.verdictCards?.scrollToCard?.(archetype);

    // Synchronize active archetype legend chip
    if (this.legendContainerEl) {
      const chips = this.legendContainerEl.querySelectorAll<HTMLElement>('.legend-chip');
      chips.forEach(chip => {
        if (chip.getAttribute('data-archetype') === archetype) {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      });
    }
  }

  public destroy(): void {
    if (this.rightColEl) {
      this.rightColEl.removeEventListener('click', this.boundRightColClick);
    }
    if (this.toggleSpiderBtn) {
      this.toggleSpiderBtn.removeEventListener('click', this.boundToggleSpiderClick);
    }
    if (this.togglePolarBtn) {
      this.togglePolarBtn.removeEventListener('click', this.boundTogglePolarClick);
    }
    if (this.radarChart) {
      this.radarChart.destroy();
    }
  }

  private render(): void {
    const existingStage = this.container.querySelector('#radar-chart-container') as HTMLElement;
    const existingVerdicts = this.container.querySelector('#verdicts-container') as HTMLElement;

    if (existingStage && existingVerdicts) {
      this.splitWrapperEl = (this.container.querySelector('.radar-overview-split') || this.container) as HTMLElement;
      this.leftColEl = (this.container.querySelector('.radar-overview-col-left') || existingStage.parentElement) as HTMLElement;
      this.rightColEl = (this.container.querySelector('.radar-overview-col-right') || existingVerdicts.parentElement) as HTMLElement;
      this.radarStageEl = existingStage;
      this.verdictsContainerEl = existingVerdicts;
      this.legendContainerEl = (this.container.querySelector('#radar-legend-container') || document.getElementById('radar-legend-container')) as HTMLElement;
      this.countBadgeEl = (this.container.querySelector('#verdicts-count-text') || document.getElementById('verdicts-count-text')) as HTMLElement;

      this.toggleSpiderBtn = (this.container.querySelector('#toggle-spider') || document.getElementById('toggle-spider')) as HTMLElement;
      this.togglePolarBtn = (this.container.querySelector('#toggle-polar') || document.getElementById('toggle-polar')) as HTMLElement;

      this.toggleSpiderBtn?.addEventListener('click', this.boundToggleSpiderClick);
      this.togglePolarBtn?.addEventListener('click', this.boundTogglePolarClick);
      this.rightColEl?.addEventListener('click', this.boundRightColClick);
    } else {
      this.container.innerHTML = '';

      // Split container layout (42% left column, 58% right column)
      this.splitWrapperEl = document.createElement('div');
      this.splitWrapperEl.className = 'radar-overview-split';

      // 1. LEFT COLUMN (42%): SVG Radar & Modes
      this.leftColEl = document.createElement('div');
      this.leftColEl.className = 'radar-overview-col-left radar-col-42';

      const radarHubCard = document.createElement('div');
      radarHubCard.className = 'radar-hub-card';

      // Header of radar hub card
      const radarHeader = document.createElement('div');
      radarHeader.className = 'radar-header';
      radarHeader.innerHTML = `
        <div class="radar-title-group">
          <h2>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="2" x2="12" y2="22"></line>
              <line x1="2" y1="12" x2="22" y2="12"></line>
            </svg>
            Стратегический радар ниш
          </h2>
          <div class="radar-subtitle">Сравнение спроса, виральности и скоринга</div>
        </div>
      `;

      const togglesContainer = document.createElement('div');
      togglesContainer.className = 'chart-mode-toggles';

      this.toggleSpiderBtn = document.createElement('button');
      this.toggleSpiderBtn.type = 'button';
      this.toggleSpiderBtn.id = 'toggle-spider';
      this.toggleSpiderBtn.className = `toggle-btn btn-mode-spider ${this.mode === 'spider' ? 'active' : ''}`;
      this.toggleSpiderBtn.textContent = 'Многоосевой радар';
      this.toggleSpiderBtn.addEventListener('click', this.boundToggleSpiderClick);

      this.togglePolarBtn = document.createElement('button');
      this.togglePolarBtn.type = 'button';
      this.togglePolarBtn.id = 'toggle-polar';
      this.togglePolarBtn.className = `toggle-btn btn-mode-polar ${this.mode === 'polar' ? 'active' : ''}`;
      this.togglePolarBtn.textContent = 'Доли рынка CCU';
      this.togglePolarBtn.addEventListener('click', this.boundTogglePolarClick);

      togglesContainer.appendChild(this.toggleSpiderBtn);
      togglesContainer.appendChild(this.togglePolarBtn);
      radarHeader.appendChild(togglesContainer);
      radarHubCard.appendChild(radarHeader);

      // Radar stage SVG container
      this.radarStageEl = document.createElement('div');
      this.radarStageEl.className = 'radar-stage-container radar-chart-stage';
      this.radarStageEl.id = 'radar-chart-container';
      radarHubCard.appendChild(this.radarStageEl);

      // Radar Legend / Archetypes Quick-Nav Strip
      this.legendContainerEl = document.createElement('div');
      this.legendContainerEl.className = 'radar-legend-container legend-list';
      this.legendContainerEl.id = 'radar-legend-container';
      radarHubCard.appendChild(this.legendContainerEl);

      this.leftColEl.appendChild(radarHubCard);

      // 2. RIGHT COLUMN (58%): Raycast Tactile Verdict Cards
      this.rightColEl = document.createElement('div');
      this.rightColEl.className = 'radar-overview-col-right verdicts-col-58';

      const verdictsSection = document.createElement('section');
      verdictsSection.className = 'verdicts-section';

      const verdictsHeader = document.createElement('div');
      verdictsHeader.className = 'verdicts-header';
      verdictsHeader.innerHTML = `
        <div class="verdicts-title-group">
          <h2>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            Вердикты и Стратегии по Архетипам
          </h2>
          <div class="verdicts-subtitle">Анализ ниш, формулы скоринга и генераторы ТЗ</div>
        </div>
        <div class="verdicts-count-badge" id="verdicts-count-text">Отображается ${this.verdicts.length} из ${this.verdicts.length}</div>
      `;
      this.countBadgeEl = verdictsHeader.querySelector('#verdicts-count-text');
      verdictsSection.appendChild(verdictsHeader);

      this.verdictsContainerEl = document.createElement('div');
      this.verdictsContainerEl.className = 'verdicts-grid verdicts-cards-container';
      this.verdictsContainerEl.id = 'verdicts-container';
      verdictsSection.appendChild(this.verdictsContainerEl);

      this.rightColEl.appendChild(verdictsSection);
      this.rightColEl.addEventListener('click', this.boundRightColClick);

      // Append columns to split wrapper and container
      this.splitWrapperEl.appendChild(this.leftColEl);
      this.splitWrapperEl.appendChild(this.rightColEl);
      this.container.appendChild(this.splitWrapperEl);
    }

    // Initialize Radar Chart Component
    this.radarChart = new RadarChartComponent({
      container: this.radarStageEl,
      verdicts: this.verdicts,
      activeArchetype: this.activeArchetype,
      onSelectArchetype: archetype => {
        this.activeArchetype = archetype;
        this.scrollToArchetype(archetype);
        this.onSelectArchetype?.(archetype);
      },
      onHoverArchetype: archetype => {
        if (archetype) {
          this.scrollToArchetype(archetype);
        } else if (!this.activeArchetype) {
          this.verdictCards?.clearHighlight?.();
        }
        this.onHoverArchetype?.(archetype);
      },
    });

    // Initialize Verdict Cards Component
    this.verdictCards = new VerdictCardsComponent({
      container: this.verdictsContainerEl,
      verdicts: this.verdicts,
      previousVerdicts: this.previousVerdicts,
      onSelectTag: tag => {
        this.onSelectTag?.(tag);
      },
    });

    this.renderLegend();
  }

  private renderLegend(): void {
    if (!this.legendContainerEl) return;
    this.legendContainerEl.innerHTML = '';

    if (!this.verdicts || this.verdicts.length === 0) return;

    this.verdicts.forEach(v => {
      const chip = document.createElement('div');
      const isSelected = this.activeArchetype === v.archetype;
      chip.className = `legend-chip ${isSelected ? 'active' : ''}`;
      chip.setAttribute('data-archetype', v.archetype);

      const statusColor =
        v.status === 'GREEN_LIGHT'
          ? '#27a644'
          : v.status === 'YELLOW_LIGHT'
          ? '#f59e0b'
          : '#eb5757';

      chip.innerHTML = `
        <span class="legend-color-dot" style="background-color: ${statusColor};"></span>
        <span class="legend-chip-title">${this.escapeHtml(v.titleRu)}</span>
        <span class="legend-chip-score">${v.opportunityScore.overallScore}</span>
      `;

      chip.addEventListener('mouseenter', () => {
        this.scrollToArchetype(v.archetype);
      });

      chip.addEventListener('mouseleave', () => {
        if (!this.activeArchetype) {
          this.verdictCards?.clearHighlight?.();
        }
      });

      chip.addEventListener('click', () => {
        const next = this.activeArchetype === v.archetype ? null : v.archetype;
        this.activeArchetype = next;
        this.scrollToArchetype(next);
        this.radarChart.updateData(this.verdicts, next);
        this.onSelectArchetype?.(next);
      });

      this.legendContainerEl.appendChild(chip);
    });
  }

  private handleRightColClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target) return;

    // 1. Click on "Сгенерировать ТЗ для ИИ" button
    const specBtn = target.closest('.btn-generate-ai-spec') as HTMLElement;
    if (specBtn) {
      e.stopPropagation();
      const arch = specBtn.getAttribute('data-archetype') as GameArchetype;
      if (arch) {
        this.onGeneratePrompt?.(arch);
      }
      return;
    }

    // 2. Click on game sample chip
    const chip = target.closest('.game-sample-chip') as HTMLElement;
    if (chip) {
      e.stopPropagation();
      const card = chip.closest('.verdict-card') as HTMLElement;
      const arch = card?.getAttribute('data-archetype') as GameArchetype | undefined;
      const title = chip.getAttribute('title') || chip.textContent?.trim() || '';
      this.onSelectGame?.(title, arch);
      return;
    }

    // 3. Click on archetype tag inside card
    const tagChip = target.closest('.card-archetype-tag') as HTMLElement;
    if (tagChip) {
      e.stopPropagation();
      const card = tagChip.closest('.verdict-card') as HTMLElement;
      const arch = card?.getAttribute('data-archetype') as GameArchetype;
      if (arch) {
        this.activeArchetype = this.activeArchetype === arch ? null : arch;
        this.scrollToArchetype(this.activeArchetype);
        this.radarChart.updateData(this.verdicts, this.activeArchetype);
        this.onSelectArchetype?.(this.activeArchetype);
      }
      return;
    }

    // 4. Click on verdict card itself
    const card = target.closest('.verdict-card') as HTMLElement;
    if (card) {
      const arch = card.getAttribute('data-archetype') as GameArchetype;
      if (arch) {
        this.scrollToArchetype(arch);
        if (this.onCardClick) {
          this.onCardClick(arch);
        } else {
          this.onSelectArchetype?.(arch);
        }
      }
    }
  }

  private updateCountBadge(): void {
    if (this.countBadgeEl) {
      this.countBadgeEl.textContent = `Отображается ${this.verdicts.length} из ${this.verdicts.length}`;
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
