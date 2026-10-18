import { BreakoutItem, GainerItem, GainersSortMode, ViralSignalItem } from './types.js';
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
}

/**
 * Собирает HTML всего экрана лидеров роста (шапка, KPI и три секции)
 */
export function renderMoversMarkup(state: MoversMarkupState): string {
  const { gainers, viralSignals, breakouts, gainersSort, hasHistory, breakoutLimit } = state;
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
            <h3 class="section-title">Топ лидеров роста CCU (${hasHistory ? '7 дней' : '24h Gainers'})</h3>
            <span class="section-subtitle">Проекты с максимальным абсолютным и процентным приростом за ${hasHistory ? 'последние 7 дней' : 'последние 24 часа'}</span>
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
