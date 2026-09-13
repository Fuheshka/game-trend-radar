import { MarketVerdict, GameArchetype } from '../types.js';

export interface VerdictCardsOptions {
  container: HTMLElement;
  verdicts: MarketVerdict[];
  onSelectTag?: (tag: string) => void;
}

export class VerdictCardsComponent {
  private container: HTMLElement;
  private verdicts: MarketVerdict[] = [];
  private onSelectTag?: (tag: string) => void;

  constructor(options: VerdictCardsOptions) {
    this.container = options.container;
    this.verdicts = options.verdicts;
    this.onSelectTag = options.onSelectTag;
    this.render();
  }

  public updateData(verdicts: MarketVerdict[]): void {
    this.verdicts = verdicts;
    this.render();
  }

  public render(): void {
    this.container.innerHTML = '';

    if (!this.verdicts || this.verdicts.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h4>Ничего не найдено</h4>
          <p>Попробуйте изменить параметры фильтрации или строку поиска</p>
        </div>
      `;
      return;
    }

    this.verdicts.forEach(v => {
      const cardEl = this.createCard(v);
      this.container.appendChild(cardEl);
    });
  }

  private createCard(v: MarketVerdict): HTMLElement {
    const card = document.createElement('div');
    const statusClass =
      v.status === 'GREEN_LIGHT'
        ? 'status-green'
        : v.status === 'YELLOW_LIGHT'
        ? 'status-yellow'
        : 'status-red';

    card.className = `verdict-card ${statusClass}`;
    card.setAttribute('data-archetype', v.archetype);

    const statusBadgeText =
      v.status === 'GREEN_LIGHT'
        ? '🟢 Green Light'
        : v.status === 'YELLOW_LIGHT'
        ? '🟡 Yellow Light'
        : '🔴 Red Light';

    const statusBadgeClass =
      v.status === 'GREEN_LIGHT' ? 'green' : v.status === 'YELLOW_LIGHT' ? 'yellow' : 'red';

    const score = v.opportunityScore.overallScore;
    const strokeColor =
      v.status === 'GREEN_LIGHT' ? '#10b981' : v.status === 'YELLOW_LIGHT' ? '#f59e0b' : '#ef4444';

    // SVG radial score calculation
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    // Core loop steps parsing
    const loopSteps = (v.coreLoopBlueprint || '')
      .split('->')
      .map(s => s.trim())
      .filter(Boolean);

    const sampleChips = (v.sampleTitles || [])
      .slice(0, 6)
      .map(
        t => `<span class="game-sample-chip" title="${t}">${this.escapeHtml(t)}</span>`
      )
      .join('');

    const viralMultiplier = v.opportunityScore.viralMultiplier || 1.0;
    const hasArbitrage = Boolean(v.hasArbitrageOpportunity);

    card.innerHTML = `
      <div class="card-top-bar">
        <div class="card-title-block">
          <h3>${this.escapeHtml(v.titleRu)}</h3>
          <div class="card-archetype-tag">${v.archetype}</div>
        </div>
        <div class="badges-stack">
          <span class="status-badge ${statusBadgeClass}">${statusBadgeText}</span>
          ${hasArbitrage ? `<span class="arbitrage-badge">⚡ ARBITRAGE OPPORTUNITY</span>` : ''}
        </div>
      </div>

      <!-- Hero Score Section -->
      <div class="score-hero-container">
        <div class="score-radial">
          <svg viewBox="0 0 72 72">
            <circle class="score-circle-bg" cx="36" cy="36" r="${radius}"></circle>
            <circle class="score-circle-fill" cx="36" cy="36" r="${radius}" 
              stroke="${strokeColor}" 
              stroke-dasharray="${circumference}" 
              stroke-dashoffset="${offset}"></circle>
          </svg>
          <span class="score-number">${score}</span>
        </div>
        <div class="score-meta">
          <div class="score-headline">Opportunity Score: ${score}/100</div>
          <div class="audience-share-bar">
            <div class="bar-labels">
              <span>Доля рынка: ${v.marketSharePercent}%</span>
              <span>CCU: ${v.totalAudienceCCU.toLocaleString()}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${Math.min(100, Math.max(4, v.marketSharePercent))}%;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Formula Breakdown -->
      <div class="formula-breakdown-box">
        <div class="formula-header">
          <span>Формула Opportunity Score</span>
          <span>Shorts Multiplier: x${viralMultiplier.toFixed(1)}</span>
        </div>
        <div class="formula-grid">
          <div class="formula-factor">
            <span class="factor-name">Спрос (Demand)</span>
            <span class="factor-val">${v.opportunityScore.demandScore}</span>
          </div>
          <div class="formula-factor">
            <span class="factor-name">Динамика (Velocity)</span>
            <span class="factor-val">${v.opportunityScore.velocityScore}</span>
          </div>
          <div class="formula-factor">
            <span class="factor-name">Монетизация</span>
            <span class="factor-val">${v.opportunityScore.monetizationScore}</span>
          </div>
          <div class="formula-factor">
            <span class="factor-name">Насыщенность</span>
            <span class="factor-val">${v.opportunityScore.saturationIndex.toFixed(1)}x</span>
          </div>
          <div class="formula-factor">
            <span class="factor-name">Трудоемкость</span>
            <span class="factor-val">${v.opportunityScore.productionEffort.toFixed(1)}x</span>
          </div>
          <div class="formula-factor">
            <span class="factor-name">Вирусность</span>
            <span class="factor-val">${(viralMultiplier).toFixed(1)}x</span>
          </div>
        </div>
        <div class="formula-expression">
          (${v.opportunityScore.demandScore} × ${v.opportunityScore.velocityScore} × ${v.opportunityScore.monetizationScore}) / (${v.opportunityScore.saturationIndex.toFixed(1)} × ${v.opportunityScore.productionEffort.toFixed(1)}) × ${viralMultiplier.toFixed(1)}
        </div>
      </div>

      <!-- Core Loop Blueprint -->
      <div class="blueprint-container">
        <div class="blueprint-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          Разбор Core Loop
        </div>
        <div class="blueprint-steps">
          ${loopSteps
            .map(
              (step, idx) => `
                <span class="loop-step">${this.escapeHtml(step)}</span>
                ${idx < loopSteps.length - 1 ? `<span class="loop-arrow">➔</span>` : ''}
              `
            )
            .join('')}
        </div>
      </div>

      <!-- Action Recommendation -->
      <div class="meta-row" style="background: rgba(56, 189, 248, 0.06); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: var(--radius-md); padding: 0.75rem 1rem;">
        <span class="meta-row-label" style="color: var(--accent-cyan); font-weight: 600;">Рекомендация:</span>
        <span class="meta-row-content" style="color: #f1f5f9; font-size: 0.84rem;">${this.escapeHtml(v.actionRecommendation)}</span>
      </div>

      <!-- Pitfalls / What to Avoid -->
      <div class="risk-alert-box">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <div class="risk-text-block">
          <span class="risk-title">Чего избегать (Риски и грабли)</span>
          <span class="risk-body">${this.escapeHtml(v.avoidPitfalls)}</span>
        </div>
      </div>

      <!-- Details: Monetization & Sample Games -->
      <div class="card-meta-details">
        <div class="meta-row">
          <span class="meta-row-label">Стратегия монетизации</span>
          <span class="meta-row-content">${this.escapeHtml(v.monetizationStrategy)}</span>
        </div>
        ${
          sampleChips
            ? `
        <div class="meta-row">
          <span class="meta-row-label">Игры-образцы в чартах</span>
          <div class="sample-tags-cloud">${sampleChips}</div>
        </div>
        `
            : ''
        }
      </div>
    `;

    return card;
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
