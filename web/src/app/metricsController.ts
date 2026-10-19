/**
 * Карточки метрик и KPI шапки: анимированные счётчики, % изменения CCU, свежесть снимка.
 */
import { MarketSnapshot } from '../types.js';
import { FALLBACK_SNAPSHOT } from '../fallbackData.js';
import { formatMinutesAgo, HeaderStatusBarComponent } from '../components/HeaderStatusBar.js';
import { animateCounter } from '../utils/animation.js';
import { formatCompactNumber, formatSnapshotDateRu } from '../utils/format.js';
import { computeMarketMetrics, MarketMetrics } from './metrics.js';
import type { AppState } from './state.js';

export interface MetricCounters {
  totalGames: number;
  totalCcu: number;
  topScore: number;
  arbitrageCount: number;
}

/**
 * Помнит метрики, показанные до текущего обновления: от них анимируются счётчики,
 * и они — запасная база для % CCU, если нет предыдущего снимка в истории.
 */
export class MetricsTracker {
  private prevMetrics: MetricCounters = { totalGames: 0, totalCcu: 0, topScore: 0, arbitrageCount: 0 };
  private initialized = false;
  /** Снимок, чьи метрики сейчас на экране — демо-данные не годятся базой для % изменения CCU. */
  private shownSnapshotId: string | null = null;

  /** Метрики нового снимка и значения, от которых анимировать счётчики. */
  next(snapshot: MarketSnapshot, previousSnapshot: MarketSnapshot | null): { metrics: MarketMetrics; from: MetricCounters } {
    // База для % изменения CCU — реальный снимок, показанный ДО этого обновления
    const baselineIsReal = this.shownSnapshotId !== null && this.shownSnapshotId !== FALLBACK_SNAPSHOT.id;
    const m = computeMarketMetrics(snapshot, previousSnapshot, baselineIsReal ? this.prevMetrics.totalCcu : 0);
    this.shownSnapshotId = snapshot.id;

    const first = !this.initialized;
    const from = first
      ? { totalGames: m.totalGames, totalCcu: m.totalCcu, topScore: m.topScore, arbitrageCount: m.arbitrageCount }
      : this.prevMetrics;
    this.initialized = true;

    this.prevMetrics = {
      totalGames: m.totalGames,
      totalCcu: m.totalCcu,
      topScore: m.topScore,
      arbitrageCount: m.arbitrageCount,
    };
    return { metrics: m, from };
  }
}

export interface MetricsControllerDeps {
  state: AppState;
  header: Pick<HeaderStatusBarComponent, 'updateKpi' | 'setSourceStatus'>;
  /** Обновить бейджи вкладок (каталог, арбитраж). */
  onCountsChanged: () => void;
}

export class MetricsController {
  private readonly tracker = new MetricsTracker();

  constructor(private readonly deps: MetricsControllerDeps) {}

  update(): void {
    const { state, header } = this.deps;
    const totalGamesEl = document.getElementById('metric-total-games');
    const totalCcuEl = document.getElementById('metric-total-ccu');
    const topScoreEl = document.getElementById('metric-top-score');
    const topGenreEl = document.getElementById('metric-top-genre');
    const arbitrageCountEl = document.getElementById('metric-arbitrage-count');
    const platformsHintEl = document.getElementById('metric-platforms-hint');

    const { metrics: m, from } = this.tracker.next(state.snapshot, state.baseSnapshot);
    if (topGenreEl && m.topGenreTitle !== null) {
      topGenreEl.textContent = m.topGenreTitle;
    }

    if (totalGamesEl) {
      animateCounter(totalGamesEl, from.totalGames, m.totalGames, 1000, val => Math.round(val).toLocaleString());
    }
    if (totalCcuEl) {
      animateCounter(totalCcuEl, from.totalCcu, m.totalCcu, 1000, val => formatCompactNumber(val));
    }
    if (topScoreEl) {
      animateCounter(topScoreEl, from.topScore, m.topScore, 1000, val => `${Math.round(val)}/100`);
    }
    if (arbitrageCountEl) {
      animateCounter(arbitrageCountEl, from.arbitrageCount, m.arbitrageCount, 1000, val => Math.round(val).toString());
    }
    if (platformsHintEl) {
      platformsHintEl.textContent = m.platformsHint;
    }

    this.deps.onCountsChanged();
    triggerMetricCardsPulse();

    header.updateKpi({
      totalGames: m.totalGames,
      totalCcu: m.totalCcu,
      ccuChangePercent: m.ccuChangePercent,
      ccuChangeBase: state.baseSnapshot ? formatSnapshotDateRu(state.baseSnapshot.timestamp) : undefined,
      arbitrageCount: m.arbitrageCount,
      topDayGameTitle: m.topGameTitle,
      updatedText: formatMinutesAgo(state.snapshot.timestamp),
    });
    header.setSourceStatus(state.snapshot.sourceStatus);
    this.refreshFreshness();
  }

  /** Обновляет «N мин назад» и подсвечивает устаревшие данные (старше 3 ч). */
  refreshFreshness(): void {
    const snapshot = this.deps.state.snapshot;
    const el = document.getElementById('kpi-updated-time');
    const ts = Date.parse(snapshot?.timestamp ?? '');
    if (!el || !Number.isFinite(ts)) return;
    el.textContent = formatMinutesAgo(snapshot.timestamp);
    const stale = Date.now() - ts > 3 * 3600_000;
    el.classList.toggle('is-stale', stale);
    el.title = stale ? 'Данные устарели — снимок рынка давно не обновлялся' : '';
  }
}

function triggerMetricCardsPulse(): void {
  const cards = document.querySelectorAll<HTMLElement>('.metrics-grid .metric-card');
  cards.forEach(card => {
    card.classList.remove('glow-pulse');
    void card.offsetWidth;
    card.classList.add('glow-pulse');
  });
}
