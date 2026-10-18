import { NormalizedGame, MarketVerdict } from '../../types.js';
import { escapeHtml } from '../../utils/dom.js';
import { getPlatformMeta } from '../../utils/labels.js';

/**
 * Builds the drawer body HTML for Archetype View mode
 */
export function buildArchetypeBodyHtml(
  verdict: MarketVerdict,
  games: NormalizedGame[],
  statusBadgeClass: string
): string {
  const score = verdict.opportunityScore.overallScore;
  const viralMultiplier = verdict.opportunityScore.viralMultiplier || 1.0;

  // Parse Core Loop steps
  const loopSteps = (verdict.coreLoopBlueprint || '')
    .split('->')
    .map(s => s.trim())
    .filter(Boolean);

  return `
        <!-- Hero Score Card -->
        <div class="drawer-stat-grid hero-score-grid">
          <div class="drawer-stat-card status-${statusBadgeClass}">
            <div class="stat-card-label">Opportunity Score</div>
            <div class="stat-card-value score-hero-val">${score} <span class="score-max">/100</span></div>
            <div class="drawer-mini-bar">
              <div class="drawer-mini-bar-fill" style="width: ${score}%;"></div>
            </div>
          </div>

          <div class="drawer-stat-card">
            <div class="stat-card-label">Доля рынка & CCU</div>
            <div class="stat-card-value">${verdict.marketSharePercent}%</div>
            <div class="stat-card-sub">${verdict.totalAudienceCCU.toLocaleString()} игроков</div>
          </div>
        </div>

        <!-- Formula Decomposition -->
        <div class="drawer-section">
          <h4 class="drawer-section-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="4" y1="9" x2="20" y2="9"></line>
              <line x1="4" y1="15" x2="20" y2="15"></line>
              <line x1="10" y1="3" x2="8" y2="21"></line>
              <line x1="16" y1="3" x2="14" y2="21"></line>
            </svg>
            Декомпозиция Opportunity Score
          </h4>
          <div class="drawer-formula-grid">
            <div class="drawer-formula-item">
              <span class="factor-name">Спрос (Demand)</span>
              <span class="factor-val">${verdict.opportunityScore.demandScore}</span>
            </div>
            <div class="drawer-formula-item">
              <span class="factor-name">Динамика (Velocity)</span>
              <span class="factor-val">${verdict.opportunityScore.velocityScore}</span>
            </div>
            <div class="drawer-formula-item">
              <span class="factor-name">Монетизация</span>
              <span class="factor-val">${verdict.opportunityScore.monetizationScore}</span>
            </div>
            <div class="drawer-formula-item">
              <span class="factor-name">Насыщенность</span>
              <span class="factor-val">${verdict.opportunityScore.saturationIndex.toFixed(1)}x</span>
            </div>
            <div class="drawer-formula-item">
              <span class="factor-name">Трудоемкость</span>
              <span class="factor-val">${verdict.opportunityScore.productionEffort.toFixed(1)}x</span>
            </div>
            <div class="drawer-formula-item">
              <span class="factor-name">Shorts Множитель</span>
              <span class="factor-val">x${viralMultiplier.toFixed(1)}</span>
            </div>
          </div>
          <div class="drawer-formula-calc">
            (${verdict.opportunityScore.demandScore} × ${verdict.opportunityScore.velocityScore} × ${verdict.opportunityScore.monetizationScore}) / (${verdict.opportunityScore.saturationIndex.toFixed(1)} × ${verdict.opportunityScore.productionEffort.toFixed(1)}) × ${viralMultiplier.toFixed(1)}
          </div>
        </div>

        <!-- Extended Core Loop Blueprint -->
        <div class="drawer-section">
          <h4 class="drawer-section-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            Расширенный Core Loop
          </h4>
          <div class="drawer-loop-chain">
            ${loopSteps
              .map(
                (step, idx) => `
              <div class="drawer-loop-node">
                <span class="loop-node-index">${idx + 1}</span>
                <span class="loop-node-text">${escapeHtml(step)}</span>
              </div>
              ${
                idx < loopSteps.length - 1
                  ? `<div class="drawer-loop-connector">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <polyline points="19 12 12 19 5 12"></polyline>
                      </svg>
                    </div>`
                  : ''
              }
            `
              )
              .join('')}
          </div>
        </div>

        <!-- Games in Archetype from Snapshot -->
        <div class="drawer-section">
          <div class="drawer-section-header">
            <h4 class="drawer-section-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="6 2 18 2 18 6 6 6 6 2"></polygon>
                <rect x="3" y="6" width="18" height="16" rx="2"></rect>
              </svg>
              Игры архетипа в снимке (${games.length})
            </h4>
            <span class="drawer-section-sub">Кликните по игре для подробностей</span>
          </div>

          <div class="drawer-games-stack">
            ${
              games.length > 0
                ? games
                    .map(g => {
                      const pMeta = getPlatformMeta(g.platform);
                      const lRatio =
                        typeof g.likeRatio === 'number'
                          ? Math.round(g.likeRatio > 1 ? g.likeRatio : g.likeRatio * 100)
                          : null;
                      return `
                  <button type="button" class="drawer-game-row" data-game-id="${g.id}">
                    <div class="game-row-left">
                      <span class="drawer-platform-dot ${pMeta.badgeClass}"></span>
                      <div class="game-row-meta">
                        <span class="game-row-title">${escapeHtml(g.title)}</span>
                        <span class="game-row-stats">
                          ${pMeta.label} • ${g.metricValue.toLocaleString()} ${g.metricType === 'ccu' ? 'CCU' : 'очков'}
                          ${lRatio ? ` • 👍 ${lRatio}%` : ''}
                        </span>
                      </div>
                    </div>
                    <svg class="game-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                `;
                    })
                    .join('')
                : `
                <div class="drawer-empty-games">
                  <span>В снимке нет прямых игр с этим архетипом</span>
                </div>
              `
            }
          </div>
        </div>

        <!-- Monetization Strategy -->
        <div class="drawer-section">
          <h4 class="drawer-section-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            Стратегия монетизации
          </h4>
          <p class="drawer-section-text">${escapeHtml(verdict.monetizationStrategy)}</p>
        </div>

        <!-- Risks and Pitfalls -->
        <div class="drawer-section drawer-risk-alert">
          <h4 class="drawer-section-title" style="color: #fb7185;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Чего избегать (Риски и грабли)
          </h4>
          <p class="drawer-section-text">${escapeHtml(verdict.avoidPitfalls)}</p>
        </div>

        <!-- Recommendation -->
        <div class="drawer-section drawer-action-box">
          <h4 class="drawer-section-title" style="color: var(--accent-cyan);">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            Рекомендация по действию
          </h4>
          <p class="drawer-section-text">${escapeHtml(verdict.actionRecommendation)}</p>
        </div>

        <!-- Footer Actions -->
        <div class="drawer-footer-actions">
          <button type="button" class="drawer-btn primary" id="drawer-btn-filter-archetype">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>Фильтровать каталог по архетипу</span>
          </button>

          <button type="button" class="drawer-btn secondary" id="drawer-btn-copy-archetype">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Скопировать название</span>
          </button>
        </div>
  `;
}
