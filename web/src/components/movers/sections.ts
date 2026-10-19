import { BreakoutItem, GainerItem, GainersSortMode, ViralSignalItem } from './types.js';
import type { ArchetypeDeltaRow } from '../../utils/snapshotDiff.js';
import { escapeHtml } from '../../utils/dom.js';
import { ICONS } from './constants.js';
import { cleanDisplayTitle, formatCCU } from './format.js';
import { renderBreakoutCards, renderGainersCards, renderViralCards } from './cards.js';

export interface MoversMarkupState {
  gainers: GainerItem[];
  viralSignals: ViralSignalItem[];
  breakouts: BreakoutItem[];
  gainersSort: GainersSortMode;
  hasHistory: boolean;
  /** Сколько карточек новинок рендерить; остальные — по кнопке */
  breakoutLimit: number;
  /** Лидеры роста считаются от явно выбранной базы ('15 окт'); null — окно 7 дней / предыдущий срез. */
  gainersBaseLabel?: string | null;
  /** «Было → стало» по архетипам; null — сравнивать не с чем. */
  archetypeDelta?: { baseLabel: string; currentLabel: string; rows: ArchetypeDeltaRow[] } | null;
}

function formatScoreDelta(before: number | null, after: number | null): string {
  if (before === null) return '<span class="delta-new">новый</span>';
  if (after === null) return '<span class="delta-gone">исчез</span>';
  const d = after - before;
  if (d === 0) return '<span class="delta-flat">0</span>';
  return `<span class="${d > 0 ? 'delta-up' : 'delta-down'}">${d > 0 ? '+' : '−'}${Math.abs(d)}</span>`;
}

function formatCcuDelta(before: number | null, after: number | null): string {
  if (before === null || after === null || before === 0) return '';
  const pct = ((after - before) / before) * 100;
  if (Math.abs(pct) < 0.05) return '';
  return ` <span class="${pct > 0 ? 'delta-up' : 'delta-down'}">${pct > 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%</span>`;
}

const dash = (v: number | null, fmt: (n: number) => string) => (v === null ? '—' : fmt(v));

/** Таблица «было → стало» по архетипам: opportunityScore и аудитория CCU двух срезов. */
export function renderArchetypeDeltaSection(delta: NonNullable<MoversMarkupState['archetypeDelta']>): string {
  const rows = delta.rows
    .map(
      r => `
        <tr data-archetype="${escapeHtml(r.archetype)}">
          <td class="archetype-delta-name">${escapeHtml(r.titleRu)}</td>
          <td class="archetype-delta-num">${dash(r.scoreBefore, String)} → ${dash(r.scoreAfter, String)}</td>
          <td class="archetype-delta-num">${formatScoreDelta(r.scoreBefore, r.scoreAfter)}</td>
          <td class="archetype-delta-num">${dash(r.ccuBefore, formatCCU)} → ${dash(r.ccuAfter, formatCCU)}${formatCcuDelta(r.ccuBefore, r.ccuAfter)}</td>
        </tr>`
    )
    .join('');
  return `
    <section class="movers-section movers-section-archetypes" data-section="archetype-delta" id="archetype-delta">
      <div class="movers-section-header">
        <div class="section-title-wrap">
          <div class="section-icon">${ICONS.TRENDING_UP}</div>
          <div>
            <h3 class="section-title">Архетипы: было → стало</h3>
            <span class="section-subtitle" data-role="archetype-delta-range">${escapeHtml(delta.baseLabel)} → ${escapeHtml(delta.currentLabel)} · Opportunity Score и аудитория CCU</span>
          </div>
        </div>
      </div>
      <div class="archetype-delta-scroll">
        <table class="archetype-delta-table">
          <thead>
            <tr><th>Архетип</th><th>Score</th><th>Δ</th><th>CCU</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

/**
 * Собирает HTML всего экрана лидеров роста (шапка, KPI и три секции)
 */
export function renderMoversMarkup(state: MoversMarkupState): string {
  const { gainers, viralSignals, breakouts, gainersSort, hasHistory, breakoutLimit, gainersBaseLabel, archetypeDelta } = state;
  const gainersWindow = gainersBaseLabel
    ? { title: `vs ${escapeHtml(gainersBaseLabel)}`, subtitle: `с ${escapeHtml(gainersBaseLabel)}` }
    : hasHistory
      ? { title: '7 дней', subtitle: 'последние 7 дней' }
      : { title: '24h Gainers', subtitle: 'последние 24 часа' };
  const hiddenBreakouts = breakouts.length - breakoutLimit;
  const topGainer = gainers[0];
  const topGainerLabel = topGainer
    ? `${cleanDisplayTitle(topGainer.game.title)} (+${formatCCU(topGainer.absDiff)})`
    : '—';

  return `
  <div class="movers-container">
    <!-- HEADER & KPI STRIP -->
    <header class="movers-header">
      <div class="movers-title-row">
        <div class="movers-title-group">
          <div class="movers-eyebrow">DefiLlama Movers & Shakers</div>
          <h2 class="movers-title">Лидеры роста и социальные индикаторы</h2>
          <p class="movers-subtitle">
            Скринер аномалий рынка: суточный прирост онлайна, опережающие мемы YouTube Shorts (&gt;1.5x) и молодые проекты (&lt; 14 дней).
          </p>
        </div>
        <div class="movers-quick-kpi">
          <div class="kpi-mini-pill">
            <span class="kpi-mini-icon">${ICONS.ZAP}</span>
            <span class="kpi-mini-label">Топ гейнер:</span>
            <span class="kpi-mini-value" id="movers-kpi-top">${topGainerLabel}</span>
          </div>
          <div class="kpi-mini-pill">
            <span class="kpi-mini-icon">${ICONS.FIRE}</span>
            <span class="kpi-mini-label">Вирусных сигналов:</span>
            <span class="kpi-mini-value">${viralSignals.length}</span>
          </div>
          <div class="kpi-mini-pill">
            <span class="kpi-mini-icon">${ICONS.ROCKET}</span>
            <span class="kpi-mini-label">Взрывных новинок:</span>
            <span class="kpi-mini-value">${breakouts.length}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- 1. СЕКЦИЯ: ТОП ЛИДЕРОВ РОСТА CCU (24H GAINERS) -->
    <section class="movers-section movers-section-gainers" data-section="gainers">
      <div class="movers-section-header">
        <div class="section-title-wrap">
          <div class="section-icon">${ICONS.TRENDING_UP}</div>
          <div>
            <h3 class="section-title">Топ лидеров роста CCU (${gainersWindow.title})</h3>
            <span class="section-subtitle">Проекты с максимальным абсолютным и процентным приростом за ${gainersWindow.subtitle}</span>
          </div>
        </div>
        <div class="gainers-sort-controls">
          <span class="sort-controls-label">Сортировка:</span>
          <div class="segmented-sort-buttons">
            <button
              type="button"
              class="gainers-sort-toggle btn-toggle-sort-abs ${gainersSort === 'abs' ? 'active' : ''}"
              data-sort-mode="abs"
              title="Ранжировать по абсолютному приросту CCU"
            >
              По абсолютному (+CCU)
            </button>
            <button
              type="button"
              class="gainers-sort-toggle btn-toggle-sort-pct ${gainersSort === 'pct' ? 'active' : ''}"
              data-sort-mode="pct"
              title="Ранжировать по процентному росту"
            >
              По проценту (+%)
            </button>
          </div>
        </div>
      </div>

      <div class="movers-grid">
        ${renderGainersCards(gainers)}
      </div>
    </section>
    ${archetypeDelta ? renderArchetypeDeltaSection(archetypeDelta) : ''}

    <!-- 2. СЕКЦИЯ: ВИРУСНЫЕ СИГНАЛЫ YOUTUBE SHORTS (> 1.5x) -->
    <section class="movers-section movers-section-viral" data-section="viral">
      <div class="movers-section-header">
        <div class="section-title-wrap">
          <div class="section-icon">${ICONS.FIRE}</div>
          <div>
            <h3 class="section-title">Вирусные сигналы YouTube Shorts</h3>
            <span class="section-subtitle">Карточки мемов с множителем viralMultiplier (&gt;1.5x) до их массового выхода в топы витрин</span>
          </div>
        </div>
        <span class="section-badge viral-badge">${viralSignals.length} активных мема</span>
      </div>

      <div class="movers-grid">
        ${renderViralCards(viralSignals)}
      </div>
    </section>

    <!-- 3. СЕКЦИЯ: ВЗРЫВНЫЕ НОВИНКИ (< 14 ДНЕЙ) -->
    <section class="movers-section movers-section-breakout" data-section="breakout">
      <div class="movers-section-header">
        <div class="section-title-wrap">
          <div class="section-icon">${ICONS.ROCKET}</div>
          <div>
            <h3 class="section-title">${hasHistory ? 'Новинки выдачи (&lt; 7 дней)' : 'Взрывные новинки (&lt; 14 дней на платформе)'}</h3>
            <span class="section-subtitle">${hasHistory ? 'Игры, которых не было в топах Roblox, Яндекса и Poki ещё неделю назад' : 'Молодые проекты витрин, быстро аккумулирующие органическую аудиторию'}</span>
          </div>
        </div>
        <span class="section-badge breakout-badge">${breakouts.length} молодых хитов</span>
      </div>

      <div class="movers-grid">
        ${renderBreakoutCards(breakouts.slice(0, breakoutLimit))}
      </div>
      ${
        hiddenBreakouts > 0
          ? `<div class="steamdb-pagination-row">
        <button type="button" class="btn-steamdb-all" data-action="show-all-breakouts">
          Показать все (${breakouts.length})
        </button>
      </div>`
          : ''
      }
    </section>
  </div>
  `;
}
