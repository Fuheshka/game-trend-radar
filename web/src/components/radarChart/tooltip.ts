import { MarketVerdict } from '../../types.js';
import { escapeHtml } from '../../utils/dom.js';

/**
 * Сборка HTML тултипа для архетипа (название экранируется через escapeHtml)
 */
export function buildTooltipHtml(
  v: MarketVerdict,
  extra?: { axisLabel?: string; axisValue?: number }
): string {
  const statusLabel =
    v.status === 'GREEN_LIGHT'
      ? 'Green Light'
      : v.status === 'YELLOW_LIGHT'
      ? 'Yellow Light'
      : 'Red Light';

  let extraRow = '';
  if (extra && extra.axisLabel !== undefined && extra.axisValue !== undefined) {
    extraRow = `
      <div class="tooltip-row" style="color: var(--accent-cyan); font-weight: 600;">
        <span>${extra.axisLabel}:</span>
        <span>${extra.axisValue}/100</span>
      </div>
    `;
  }

  return `
    <div class="tooltip-title">${escapeHtml(v.titleRu)}</div>
    ${extraRow}
    <div class="tooltip-row">
      <span>Статус:</span>
      <span>${statusLabel}</span>
    </div>
    <div class="tooltip-row">
      <span>Opportunity Score:</span>
      <span style="font-weight: 700; color: #fff;">${v.opportunityScore.overallScore}/100</span>
    </div>
    <div class="tooltip-row">
      <span>Аудитория CCU:</span>
      <span>${v.totalAudienceCCU.toLocaleString()} (${v.marketSharePercent}%)</span>
    </div>
    <div class="tooltip-row">
      <span>Виральный множитель:</span>
      <span>x${(v.opportunityScore.viralMultiplier || 1.0).toFixed(1)}</span>
    </div>
    <div style="margin-top: 6px; font-size: 0.72rem; color: #89dceb;">Кликните для фильтрации карточек</div>
  `;
}
