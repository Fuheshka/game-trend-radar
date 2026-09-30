import { ArbitrageOpportunity, NormalizedGame, ArbitrageAnalogMatch, GameArchetype } from '../types.js';

export interface ArbitrageMatrixOptions {
  container: HTMLElement;
  opportunities: ArbitrageOpportunity[];
  onSelectGame?: (game: NormalizedGame) => void;
  onOpenRoblox?: (url: string) => void;
}

const ARCHETYPE_RU: Record<GameArchetype, string> = {
  SIMULATION_INCREMENTAL: 'Симуляторы и +1',
  PHYSICS_SANDBOX: 'Сендбокс и физика',
  MERGE_IDLE: 'Мёрдж и крафт',
  SURVIVAL_HORROR: 'Сурвайвал хоррор',
  WORD_PUZZLE: 'Словесные игры',
  ACTION_SHOOTER: 'Экшен и шутеры',
  OBBY_PARKOUR: 'Обби и паркур',
  OTHER_CASUAL: 'Казуальные игры',
};

export function cleanDisplayTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/\[\s*\]/g, '') // empty square brackets [ ]
    .replace(/\(\s*\)/g, '') // empty round brackets ( )
    .replace(/\[\p{Extended_Pictographic}[^\]]*\]/gu, '') // emoji tags in brackets like [🌋]
    .replace(/\p{Extended_Pictographic}|\uFE0F|\uFE0E/gu, '') // loose emojis
    .replace(/\s+/g, ' ')
    .trim();
}

export class ArbitrageMatrixComponent {
  private container: HTMLElement;
  private opportunities: ArbitrageOpportunity[] = [];
  private onSelectGame?: (game: NormalizedGame) => void;
  private onOpenRoblox?: (url: string) => void;
  private min100kOnly: boolean = false;

  constructor(options: ArbitrageMatrixOptions) {
    this.container = options.container;
    this.opportunities = options.opportunities || [];
    this.onSelectGame = options.onSelectGame;
    this.onOpenRoblox = options.onOpenRoblox;

    this.initEvents();
    this.render();
  }

  public updateData(opportunities: ArbitrageOpportunity[]): void {
    this.opportunities = opportunities || [];
    this.render();
  }

  public getTotalCount(): number {
    return this.opportunities.length;
  }

  public getFilteredCount(): number {
    return this.getFilteredOpportunities().length;
  }

  public isMin100kOnly(): boolean {
    return this.min100kOnly;
  }

  public setMin100kOnly(val: boolean): void {
    if (this.min100kOnly === val) return;
    this.min100kOnly = val;
    this.render();
  }

  public toggleMin100k(): boolean {
    this.min100kOnly = !this.min100kOnly;
    this.render();
    return this.min100kOnly;
  }

  private getFilteredOpportunities(): ArbitrageOpportunity[] {
    if (!this.min100kOnly) {
      return this.opportunities;
    }
    return this.opportunities.filter(opp => (opp.robloxCCU || opp.robloxGame.metricValue) >= 100_000);
  }

  private initEvents(): void {
    this.container.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Filter toggle button inside component header
      const toggleBtn = target.closest('.btn-arbitrage-100k-toggle') as HTMLElement;
      if (toggleBtn) {
        e.stopPropagation();
        this.toggleMin100k();
        return;
      }

      // External link click to original game
      const linkBtn = target.closest('.btn-open-donor') as HTMLElement;
      if (linkBtn) {
        e.stopPropagation();
        const url = linkBtn.getAttribute('data-url');
        if (url && this.onOpenRoblox) {
          this.onOpenRoblox(url);
        } else if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
        return;
      }

      // Card click -> inspect game
      const card = target.closest('.arbitrage-card') as HTMLElement;
      if (card) {
        const gameId = card.getAttribute('data-game-id');
        const opp = this.opportunities.find(o => o.robloxGame.id === gameId);
        if (opp && this.onSelectGame) {
          this.onSelectGame(opp.robloxGame);
        }
      }
    });
  }

  private formatCCU(val: number): string {
    const formatted = val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${formatted} CCU`;
  }

  private formatRating(likeRatio?: number): string {
    if (likeRatio === undefined || likeRatio === null) return '—';
    return `${Math.round(likeRatio * 100)}% 👍`;
  }

  private resolveEngineRecommendation(archetype: GameArchetype): string {
    switch (archetype) {
      case 'PHYSICS_SANDBOX':
      case 'ACTION_SHOOTER':
      case 'SURVIVAL_HORROR':
        return 'Unity WebGL (URP)';
      case 'SIMULATION_INCREMENTAL':
      case 'MERGE_IDLE':
      case 'WORD_PUZZLE':
      case 'OBBY_PARKOUR':
      case 'OTHER_CASUAL':
      default:
        return 'Vite / Canvas 2D';
    }
  }

  private resolveWindowLeadTime(potential: string): { label: string; time: string; badgeClass: string } {
    switch (potential) {
      case 'CRITICAL_FIRST_MOVER':
        return {
          label: 'Критическое преимущество (Первый ход)',
          time: 'Запас до клонов: 1-2 недели',
          badgeClass: 'potential-critical',
        };
      case 'VERY_HIGH':
        return {
          label: 'Свободная ниша (Высокий спрос)',
          time: 'Запас до клонов: 2-4 недели',
          badgeClass: 'potential-very-high',
        };
      case 'HIGH':
      default:
        return {
          label: 'Перспективная ниша',
          time: 'Запас до клонов: 3-6 недель',
          badgeClass: 'potential-high',
        };
    }
  }

  public render(): void {
    const filtered = this.getFilteredOpportunities();
    const totalCount = this.opportunities.length;
    const totalGapCcu = filtered.reduce((acc, o) => acc + (o.robloxCCU || 0), 0);

    let html = `
      <div class="arbitrage-matrix-wrapper">
        <!-- Matrix Analytical Header -->
        <div class="arbitrage-summary-bar">
          <div class="arbitrage-summary-left">
            <div class="arbitrage-headline">
              <span class="pulse-beacon-dot"></span>
              <h3>Зазоры спроса между Roblox, Яндекс Играми и Poki</h3>
            </div>
            <p class="arbitrage-subtext">
              Выявление хитов мирового рынка с подтвержденной аудиторией, которые еще не клонированы на локальных веб-витринах.
            </p>
          </div>

          <div class="arbitrage-summary-right">
            <div class="arbitrage-stat-item">
              <span class="arbitrage-stat-label">Суммарный зазор спроса:</span>
              <span class="arbitrage-stat-value text-accent">${totalGapCcu.toLocaleString('ru-RU')} CCU</span>
            </div>

            <button type="button" class="btn-arbitrage-100k-toggle ${this.min100kOnly ? 'active' : ''}" aria-pressed="${this.min100kOnly}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <span>Только с онлайном от 100k CCU</span>
              <span class="filter-count-pill">${filtered.length}</span>
            </button>
          </div>
        </div>
    `;

    if (filtered.length === 0) {
      html += `
        <div class="arbitrage-empty-state">
          <div class="empty-icon-shield">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-lavender)" stroke-width="1.75">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
          <h4>В текущей выборке нет активных арбитражных ниш</h4>
          <p>Все игры удовлетворяют текущему фильтру или имеют прямые аналоги в каталоге Яндекс Игр.</p>
        </div>
      </div>`;
      this.container.innerHTML = html;
      return;
    }

    html += `<div class="arbitrage-cards-grid">`;

    for (const opp of filtered) {
      const windowInfo = this.resolveWindowLeadTime(opp.organicPotential);
      const recommendedEngine = this.resolveEngineRecommendation(opp.archetype);
      const similarityPercent = Math.round((opp.similarityWithNearestAnalog || 0) * 100);
      const donorPlatform = opp.robloxGame.platform === 'roblox' ? 'Roblox' : 'YouTube Shorts';
      const archetypeLabel = ARCHETYPE_RU[opp.archetype] || opp.archetype;
      const donorRating = this.formatRating(opp.robloxGame.likeRatio);
      const donorCcu = this.formatCCU(opp.robloxCCU || opp.robloxGame.metricValue);

      // Analog information
      const hasAnalog = opp.nearestAnalog !== null && opp.nearestAnalog !== undefined && similarityPercent >= 20;
      const analogTitle = hasAnalog ? opp.nearestAnalog!.title : 'Аналог отсутствует';
      const displayAnalogTitle = hasAnalog ? cleanDisplayTitle(opp.nearestAnalog!.title) : 'Аналог отсутствует';
      const similarityMetricLabel = hasAnalog ? 'Схожесть механик' : 'В каталоге не найден';
      const displayDonorTitle = cleanDisplayTitle(opp.robloxGame.title);

      html += `
        <article class="arbitrage-card ${windowInfo.badgeClass}" data-game-id="${opp.robloxGame.id}">
          <!-- Card Header & Opportunity Badge -->
          <div class="arbitrage-card-header">
            <div class="arbitrage-badge-group">
              <span class="badge-potential ${windowInfo.badgeClass}">
                <span class="indicator-dot"></span>
                ${windowInfo.label}
              </span>
              <span class="badge-lead-time">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                ${windowInfo.time}
              </span>
            </div>

            <span class="badge-archetype">${archetypeLabel}</span>
          </div>

          <!-- Market Split Comparison (Donor vs Target Showcase) -->
          <div class="market-comparison-split">
            <!-- Left: Donor Game -->
            <div class="market-side donor-side">
              <div class="market-side-label">
                <span class="platform-tag roblox">${donorPlatform}</span>
                <span class="role-text">Игра-донор</span>
              </div>

              <h4 class="donor-game-title" title="${opp.robloxGame.title}">${displayDonorTitle}</h4>

              <div class="donor-metrics-row">
                <div class="donor-metric">
                  <span class="metric-caption">Активный онлайн</span>
                  <span class="metric-val ccu-val">${donorCcu}</span>
                </div>
                <div class="donor-metric">
                  <span class="metric-caption">Одобрение</span>
                  <span class="metric-val rating-val">${donorRating}</span>
                </div>
              </div>

              ${
                opp.robloxGame.url
                  ? `<a href="${opp.robloxGame.url}" target="_blank" rel="noopener noreferrer" class="btn-open-donor" data-url="${opp.robloxGame.url}">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                      <span>Оригинал в каталоге</span>
                    </a>`
                  : ''
              }
            </div>

            <!-- Middle: Gap Direction Arrow -->
            <div class="market-split-divider">
              <div class="gap-arrow-badge" title="Зазор спроса">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </div>
              <span class="gap-text">Зазор спроса</span>
            </div>

            <!-- Right: Target Showcase (Yandex Games / Poki) -->
            <div class="market-side target-side">
              <div class="market-side-label">
                <span class="platform-tag yandex">Яндекс Игры / Poki</span>
                <span class="role-text">Целевая витрина</span>
              </div>

              <div class="analog-info-box">
                <div class="analog-title-row">
                  <span class="analog-label">Ближайший аналог:</span>
                  <strong class="analog-name ${hasAnalog ? 'text-primary' : 'text-empty'}" title="${analogTitle}">${displayAnalogTitle}</strong>
                </div>

                <div class="similarity-bar-wrap">
                  <div class="similarity-bar-labels">
                    <span class="similarity-text">${similarityMetricLabel}</span>
                    <span class="similarity-percentage">${similarityPercent}% схожести</span>
                  </div>
                  <div class="similarity-progress-track">
                    <div class="similarity-progress-fill ${similarityPercent < 25 ? 'green' : similarityPercent < 50 ? 'yellow' : 'orange'}" style="width: ${Math.max(similarityPercent, 2)}%"></div>
                  </div>
                </div>

                <div class="niche-freedom-status ${hasAnalog ? 'partial' : 'pure'}">
                  ${
                    hasAnalog
                      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                         <span>${similarityPercent >= 65 ? 'Прямой клон в каталоге' : 'Косвенный аналог без доминирования'}</span>`
                      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--status-green)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                         <span class="text-free-niche">100% свободная ниша в каталоге</span>`
                  }
                </div>
              </div>
            </div>
          </div>

          <!-- Adaptation Strategy & Specifications -->
          <div class="adaptation-strategy-card">
            <div class="strategy-header">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
              <span>Конкретная стратегия веб-адаптации</span>
            </div>

            <p class="strategy-description-text">${opp.adaptationStrategy}</p>

            <div class="strategy-specs-grid">
              <div class="spec-pill">
                <span class="spec-label">Движок:</span>
                <span class="spec-value">${recommendedEngine}</span>
              </div>
              <div class="spec-pill">
                <span class="spec-label">Вес билда:</span>
                <span class="spec-value text-green">&lt; 15 МБ (быстрый старт)</span>
              </div>
              <div class="spec-pill">
                <span class="spec-label">Монетизация:</span>
                <span class="spec-value">Rewarded Video + Interstitial</span>
              </div>
            </div>
          </div>

          <!-- Suggested Localized Title for RU Showcase -->
          <div class="suggested-title-card">
            <div class="suggested-title-tag">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>Название для РФ</span>
            </div>
            <div class="suggested-title-text">${opp.suggestedRuTitle}</div>
          </div>
        </article>
      `;
    }

    html += `</div></div>`;
    this.container.innerHTML = html;
  }
}
