import { escapeHtml } from '../../utils/dom.js';
import { BreakoutItem, GainerItem, SparklineData, ViralSignalItem } from './types.js';
import { ICONS, PLATFORM_NAMES } from './constants.js';
import { ARCHETYPE_RU_MAP } from '../../utils/labels.js';
import { cleanDisplayTitle, formatCCU } from './format.js';

export function renderSparklineSvg(spark: SparklineData, color: string): string {
  return `
    <svg class="mover-sparkline" width="80" height="24" viewBox="0 0 80 24">
      <path d="${spark.svgPath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="${spark.endX}" cy="${spark.endY}" r="2.5" fill="${color}" />
    </svg>
  `;
}

export function renderGainersCards(gainers: GainerItem[]): string {
  if (gainers.length === 0) {
    return `
      <div class="movers-empty-card">
        <span class="empty-icon">${ICONS.CHART_BAR}</span>
        <p>Недостаточно исторических данных для фиксации 24h дельты. Сделайте повторный скан рынка.</p>
      </div>
    `;
  }

  return gainers.map(item => {
    const g = item.game;
    const cleanTitle = cleanDisplayTitle(g.title);
    const platLabel = PLATFORM_NAMES[g.platform] || g.platform;
    const archLabel = ARCHETYPE_RU_MAP[g.archetype] || g.archetype;
    const pctSign = item.pctDiff >= 0 ? '+' : '';
    const sparkSvg = renderSparklineSvg(item.sparkline, '#27a644');

    return `
      <div class="movers-card card-gainer" data-card="mover" data-id="${escapeHtml(g.id)}">
        <div class="card-top-row">
          <span class="card-rank">#${item.rank}</span>
          <span class="card-platform-badge ${g.platform}">${platLabel}</span>
          <span class="card-growth-badge positive">
            <span class="badge-arrow">${ICONS.ARROW_UP}</span>
            <span>+${formatCCU(item.absDiff)} (${pctSign}${item.pctDiff}%)</span>
          </span>
        </div>

        <div class="card-main-info">
          <h4 class="card-title movers-card-title" title="${escapeHtml(g.title)}">${escapeHtml(cleanTitle)}</h4>
          <div class="card-metrics-row">
            <div class="metric-block">
              <span class="metric-caption">Онлайн CCU</span>
              <span class="metric-num">${formatCCU(item.currentCcu)}</span>
            </div>
            <div class="sparkline-wrapper">
              ${sparkSvg}
            </div>
          </div>
        </div>

        <div class="card-bottom-row">
          <span class="archetype-tag badge-archetype" data-archetype="${escapeHtml(g.archetype)}" title="Архетип: ${escapeHtml(archLabel)}">
            ${escapeHtml(archLabel)}
          </span>
          <button
            type="button"
            class="btn-inspect card-inspect-btn"
            data-action="inspect"
            data-game-id="${escapeHtml(g.id)}"
            title="Открыть аналитический инспектор игры"
          >
            <span>Инспектор</span>
            ${ICONS.CHEVRON_RIGHT}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

export function renderViralCards(viralSignals: ViralSignalItem[]): string {
  if (viralSignals.length === 0) {
    return `
      <div class="movers-empty-card">
        <span class="empty-icon">${ICONS.FIRE}</span>
        <p>В текущем снимке нет сигналов с множителем viralMultiplier &gt; 1.5x.</p>
      </div>
    `;
  }

  return viralSignals.map(item => {
    const archLabel = ARCHETYPE_RU_MAP[item.archetype] || item.archetype;
    const sparkSvg = renderSparklineSvg(item.sparkline, '#ff7043');
    const gameId = item.associatedGame?.id || '';

    return `
      <div class="movers-card card-viral" data-card="mover" data-id="${escapeHtml(item.id)}" data-archetype="${escapeHtml(item.archetype)}">
        <div class="card-top-row">
          <span class="card-viral-multiplier">
            ${ICONS.FIRE}
            <span>${item.viralMultiplier}x Multiplier</span>
          </span>
          <span class="card-signal-badge">Опережающий сигнал</span>
        </div>

        <div class="card-main-info">
          <h4 class="card-title movers-card-title">${escapeHtml(item.trendTitle)}</h4>
          <div class="card-metrics-row">
            <div class="metric-block">
              <span class="metric-caption">Вирусный охват</span>
              <span class="metric-num">${item.metricValue} pts</span>
            </div>
            <div class="sparkline-wrapper">
              ${sparkSvg}
            </div>
          </div>
        </div>

        <div class="card-bottom-row">
          <span class="archetype-tag badge-archetype" data-archetype="${escapeHtml(item.archetype)}" title="Архетип: ${escapeHtml(archLabel)}">
            ${escapeHtml(archLabel)}
          </span>
          <button
            type="button"
            class="btn-inspect card-inspect-btn"
            data-action="inspect"
            data-game-id="${escapeHtml(gameId)}"
            data-archetype="${escapeHtml(item.archetype)}"
            title="Открыть инспектор тренда"
          >
            <span>Инспектор</span>
            ${ICONS.CHEVRON_RIGHT}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

export function renderBreakoutCards(breakouts: BreakoutItem[]): string {
  if (breakouts.length === 0) {
    return `
      <div class="movers-empty-card">
        <span class="empty-icon">${ICONS.ROCKET}</span>
        <p>Новых проектов с быстрой динамикой (&lt; 14 дней) пока не обнаружено.</p>
      </div>
    `;
  }

  return breakouts.map(item => {
    const g = item.game;
    const cleanTitle = cleanDisplayTitle(g.title);
    const platLabel = PLATFORM_NAMES[g.platform] || g.platform;
    const archLabel = ARCHETYPE_RU_MAP[g.archetype] || g.archetype;
    const sparkSvg = renderSparklineSvg(item.sparkline, '#02b8cc');

    return `
      <div class="movers-card card-breakout" data-card="mover" data-id="${escapeHtml(g.id)}">
        <div class="card-top-row">
          <span class="card-rank">#${item.rank}</span>
          <span class="card-platform-badge ${g.platform}">${platLabel}</span>
          <span class="card-age-badge">
            ${ICONS.SPARK}
            <span>${escapeHtml(item.growthBadge)}</span>
          </span>
        </div>

        <div class="card-main-info">
          <h4 class="card-title movers-card-title" title="${escapeHtml(g.title)}">${escapeHtml(cleanTitle)}</h4>
          <div class="card-metrics-row">
            <div class="metric-block">
              <span class="metric-caption">${g.metricType === 'rank' ? 'Позиция' : g.metricType === 'rating' ? 'Рейтинг' : 'Стартовый CCU'}</span>
              <span class="metric-num">${g.metricType === 'rank' ? `#${item.ccu}` : g.metricType === 'rating' ? item.ccu : formatCCU(item.ccu)}</span>
            </div>
            <div class="sparkline-wrapper">
              ${sparkSvg}
            </div>
          </div>
        </div>

        <div class="card-bottom-row">
          <span class="archetype-tag badge-archetype" data-archetype="${escapeHtml(g.archetype)}" title="Архетип: ${escapeHtml(archLabel)}">
            ${escapeHtml(archLabel)}
          </span>
          <button
            type="button"
            class="btn-inspect card-inspect-btn"
            data-action="inspect"
            data-game-id="${escapeHtml(g.id)}"
            title="Открыть аналитический инспектор новинки"
          >
            <span>Инспектор</span>
            ${ICONS.CHEVRON_RIGHT}
          </button>
        </div>
      </div>
    `;
  }).join('');
}
