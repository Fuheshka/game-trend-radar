import { GameHistoryResponse } from '../../types.js';
import { escapeHtml } from '../../utils/dom.js';
import { formatCompactNumber, formatSnapshotDateRu } from '../../utils/format.js';
import { generateMoversSparkline } from '../movers/sparkline.js';

const CHART_W = 300;
const CHART_H = 80;

type HistoryPoint = GameHistoryResponse['points'][number];

interface HistorySeries {
  label: string;
  dates: string[];
  values: number[];
  format: (n: number) => string;
  /** Для позиции меньше = лучше: на графике рост вверх — подъём в выдаче. */
  lowerIsBetter: boolean;
}

/**
 * Что рисовать: Roblox — CCU, Poki/CrazyGames — позицию, Яндекс — число оценок (рейтинг почти не меняется).
 * Оценки Яндекса пишутся с 18 окт; до этого у ~90% игр в рейтинге стояла заглушка 75 запасного парсера,
 * поэтому, если оценки есть хоть в одной точке, берём только точки с ними.
 */
export function pickHistorySeries(history: GameHistoryResponse): HistorySeries {
  const pts = history.points;
  const of = (label: string, list: HistoryPoint[], value: (p: HistoryPoint) => number, format: (n: number) => string) => ({
    label,
    dates: list.map(p => p.date),
    values: list.map(value),
    format,
    lowerIsBetter: false,
  });
  if (history.metricType === 'rank') {
    return { ...of('Позиция в выдаче', pts, p => p.value, n => `#${n}`), lowerIsBetter: true };
  }
  if (history.metricType === 'rating') {
    const withVotes = pts.filter(p => p.votes !== undefined);
    if (withVotes.length > 0) return of('Число оценок', withVotes, p => p.votes!, formatCompactNumber);
    return of('Рейтинг', pts, p => p.value, n => (Number.isInteger(n) ? String(n) : n.toFixed(1)));
  }
  return of('Онлайн (CCU)', pts, p => p.value, formatCompactNumber);
}

function section(body: string): string {
  return `
    <h4 class="drawer-section-title">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
      </svg>
      История по дням
    </h4>
    ${body}
  `;
}

/** Содержимое блока `#drawer-history` до ответа API или без него. */
export function buildHistoryPlaceholderHtml(kind: 'loading' | 'no-api' | 'empty'): string {
  if (kind === 'loading') return section('<p class="drawer-history-note">Загружаем историю…</p>');
  if (kind === 'no-api') {
    return section(
      '<p class="drawer-history-note">История копится на сервере: ' +
        '<a href="https://radar.fuheshka.qd.je" target="_blank" rel="noopener">открыть на radar.fuheshka.qd.je</a></p>'
    );
  }
  return section('<p class="drawer-history-note">История по этой игре ещё не накоплена.</p>');
}

/** SVG-график истории с подписями мин/макс и датами крайних точек. */
export function buildHistoryChartHtml(history: GameHistoryResponse): string {
  if (history.points.length === 0) return buildHistoryPlaceholderHtml('empty');
  const series = pickHistorySeries(history);
  const dates = series.dates;
  if (dates.length === 1) {
    return section(
      `<p class="drawer-history-note">Пока одна точка. ${escapeHtml(series.label)}: ${escapeHtml(series.format(series.values[0]))} ` +
        `на ${escapeHtml(formatSnapshotDateRu(dates[0]))}. График появится со следующего дня.</p>`
    );
  }

  const plotted = series.lowerIsBetter ? series.values.map(v => -v) : series.values;
  const spark = generateMoversSparkline(plotted, CHART_W, CHART_H, 4);
  const best = series.lowerIsBetter ? Math.min(...series.values) : Math.max(...series.values);
  const worst = series.lowerIsBetter ? Math.max(...series.values) : Math.min(...series.values);
  const first = series.values[0];
  const last = series.values[series.values.length - 1];
  const improved = series.lowerIsBetter ? last <= first : last >= first;
  const color = improved ? '#27a644' : '#ef4444';

  return section(`
    <div class="drawer-history-meta">
      <span>${escapeHtml(series.label)}: <strong>${escapeHtml(series.format(last))}</strong></span>
      <span class="drawer-history-days">${dates.length} дн.</span>
    </div>
    <div class="drawer-history-chart">
      <div class="drawer-history-axis">
        <span data-role="best">${escapeHtml(series.format(best))}</span>
        <span data-role="worst">${escapeHtml(series.format(worst))}</span>
      </div>
      <svg class="drawer-history-svg" viewBox="0 0 ${CHART_W} ${CHART_H}" role="img" aria-label="${escapeHtml(series.label)} по дням">
        <path d="${spark.svgPath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="${spark.endX}" cy="${spark.endY}" r="3" fill="${color}" />
      </svg>
    </div>
    <div class="drawer-history-dates">
      <span>${escapeHtml(formatSnapshotDateRu(dates[0]))}</span>
      <span>${escapeHtml(formatSnapshotDateRu(dates[dates.length - 1]))}</span>
    </div>
  `);
}
