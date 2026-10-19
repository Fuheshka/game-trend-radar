/**
 * Снимки рынка: список срезов, кэш, селектор в шапке и выбор режима данных.
 *
 * Режимы по убыванию: API (`/api/snapshots` ответил) → `/api/snapshots/latest` → статический снимок
 * GitHub Pages → встроенные демо-данные. «Нет API» = список срезов недоступен (null): тогда скан
 * прячется и SSE не подключается. Пустой список (`[]`) — сервер жив, просто снимков ещё нет.
 */
import { FALLBACK_SNAPSHOT } from '../fallbackData.js';
import * as snapshotApi from '../services/snapshotApi.js';
import type { HeaderStatusBarComponent } from '../components/HeaderStatusBar.js';
import { formatSnapshotOptionLabel } from '../utils/format.js';
import type { AppState } from './state.js';
import { setServerStatus, ServerStatusSetter } from './ui.js';

export type SnapshotApi = Pick<
  typeof snapshotApi,
  'fetchSnapshotList' | 'fetchSnapshotById' | 'fetchLatestSnapshot' | 'fetchStaticSnapshot'
>;
export type SnapshotHeader = Pick<HeaderStatusBarComponent, 'setScanAvailable' | 'setSnapshots' | 'setSseStatus'>;
/** Селектор срезов: нужны только value и число опций. */
export type SnapshotSelect = Pick<HTMLSelectElement, 'value'> & { options: { length: number } };

export interface SnapshotControllerDeps {
  state: AppState;
  header: SnapshotHeader;
  /** Подключить SSE — только при живом API. */
  connectLive: () => void;
  /** Перерисовать все вкладки по state.snapshot. */
  onApply: () => void;
  api?: SnapshotApi;
  setServerStatus?: ServerStatusSetter;
  getSelect?: () => SnapshotSelect | null;
  animateTransition?: () => void;
}

export class SnapshotController {
  private readonly state: AppState;
  private readonly header: SnapshotHeader;
  private readonly connectLive: () => void;
  private readonly onApply: () => void;
  private readonly api: SnapshotApi;
  private readonly setServerStatus: ServerStatusSetter;
  private readonly getSelect: () => SnapshotSelect | null;
  private readonly animateTransition: () => void;

  constructor(deps: SnapshotControllerDeps) {
    this.state = deps.state;
    this.header = deps.header;
    this.connectLive = deps.connectLive;
    this.onApply = deps.onApply;
    this.api = deps.api ?? snapshotApi;
    this.setServerStatus = deps.setServerStatus ?? setServerStatus;
    this.getSelect = deps.getSelect ?? (() => document.getElementById('snapshot-select') as HTMLSelectElement | null);
    this.animateTransition = deps.animateTransition ?? triggerSnapshotTransitionAnimation;
  }

  async fetchSnapshots(): Promise<void> {
    const list = await this.api.fetchSnapshotList();
    // /api/snapshots недоступен — статика (GitHub Pages) или сервер лежит: запускать скан некуда
    this.header.setScanAvailable(list !== null);
    if (list) {
      // SSE только при живом API: на статике /api/events нет, и EventSource ретраил бы его бесконечно
      this.connectLive();
      this.state.snapshotsList = list;
      this.setServerStatus(true, 'HTTP :4200 (Online)');

      if (this.state.snapshotsList.length > 0) {
        this.populateSnapshotSelect();
        // Load the latest snapshot (first in list)
        await this.selectSnapshot(this.state.snapshotsList[0].id, false);
        return;
      }
    }

    // Fallback: try fetching /api/snapshots/latest or static fallback
    await this.fetchLatestSnapshot();
  }

  private populateSnapshotSelect(): void {
    const options = this.state.snapshotsList.map(s => ({
      id: s.id,
      label: formatSnapshotOptionLabel(s.date, s.totalGamesScanned),
      date: s.date,
      gamesCount: s.totalGamesScanned,
    }));
    this.header.setSnapshots(options, this.state.snapshotsList[0]?.id);
  }

  async selectSnapshot(snapshotId: string, animate: boolean = true): Promise<void> {
    if (!snapshotId) return;

    const select = this.getSelect();
    if (select && select.value !== snapshotId) {
      select.value = snapshotId;
    }

    try {
      const data = await this.api.fetchSnapshotById(snapshotId, this.state.snapshotsCache);

      if (data) {
        this.state.snapshot = data;
        this.state.currentSnapshotId = snapshotId;

        // Find immediately preceding snapshot in history (idx + 1 in date-descending list)
        const list = this.state.snapshotsList;
        const currIdx = list.findIndex(s => s.id === snapshotId);
        if (currIdx >= 0 && currIdx + 1 < list.length) {
          const prevSummary = list[currIdx + 1];
          // Сбой загрузки предыдущего снимка не мешает показать текущий
          const prevData = await this.api
            .fetchSnapshotById(prevSummary.id, this.state.snapshotsCache)
            .catch(() => undefined);
          this.state.previousSnapshot = prevData || null;
        } else {
          this.state.previousSnapshot = null;
        }

        if (animate) {
          this.animateTransition();
        }

        this.onApply();
      }
    } catch (err) {
      console.error('Failed to load snapshot:', err);
    }
  }

  async fetchLatestSnapshot(): Promise<void> {
    const data = await this.api.fetchLatestSnapshot();
    if (data) {
      this.state.snapshot = data;
      this.state.currentSnapshotId = data.id;
      this.state.snapshotsCache.set(data.id, data);
      this.setServerStatus(true, 'HTTP :4200 (Online)');
      this.header.setSseStatus(true, 'SSE Live');

      // Populate single fallback option if snapshotsList is empty
      const select = this.getSelect();
      if (select && select.options.length <= 1) {
        this.header.setSnapshots([
          {
            id: data.id,
            label: formatSnapshotOptionLabel(data.timestamp, data.totalGamesScanned),
          },
        ], data.id);
      }
    } else {
      await this.tryStaticSnapshotFallback();
    }

    this.onApply();
  }

  private async tryStaticSnapshotFallback(): Promise<void> {
    const staticData = await this.api.fetchStaticSnapshot();
    if (staticData) {
      this.state.snapshot = staticData;
      this.setServerStatus(true, 'GitHub Pages (Статика)');
      this.header.setSseStatus(true, 'Статика');
      this.header.setSnapshots([
        { id: staticData.id, label: formatSnapshotOptionLabel(staticData.timestamp, staticData.totalGamesScanned) },
      ], staticData.id);
      return;
    }

    this.setServerStatus(false, 'Демонстрационный режим');
    this.header.setSseStatus(false, 'Оффлайн');
    if (this.state.snapshot === FALLBACK_SNAPSHOT) {
      this.header.setSnapshots([{ id: FALLBACK_SNAPSHOT.id, label: 'Демо-данные' }], FALLBACK_SNAPSHOT.id);
    }
  }
}

/** Короткое затухание блоков при ручной смене среза. */
export function triggerSnapshotTransitionAnimation(): void {
  const targets = [
    document.getElementById('verdicts-grid'),
    document.getElementById('radar-chart-container'),
    document.getElementById('metrics-hero-grid'),
    document.getElementById('catalog-content'),
    document.getElementById('arbitrage-matrix-container'),
    document.getElementById('view-movers'),
  ].filter(Boolean) as HTMLElement[];

  targets.forEach(el => {
    el.classList.remove('snapshot-fade-update');
    void el.offsetWidth; // Force reflow
    el.classList.add('snapshot-fade-update');
  });

  setTimeout(() => {
    targets.forEach(el => el.classList.remove('snapshot-fade-update'));
  }, 400);
}
