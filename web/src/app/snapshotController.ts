/**
 * Снимки рынка: список срезов, кэш, селектор в шапке и выбор режима данных.
 *
 * Режимы по убыванию: API (`/api/snapshots` ответил) → `/api/snapshots/latest` → статический снимок
 * GitHub Pages → встроенные демо-данные. «Нет API» = список срезов недоступен (null): тогда скан
 * прячется и SSE не подключается. Пустой список (`[]`) — сервер жив, просто снимков ещё нет.
 *
 * База сравнения: срез из «Сравнить с» (`?compare=` в URL) или предыдущий; без API селектор скрыт.
 */
import { FALLBACK_SNAPSHOT } from '../fallbackData.js';
import * as snapshotApi from '../services/snapshotApi.js';
import type { HeaderStatusBarComponent } from '../components/HeaderStatusBar.js';
import { formatSnapshotOptionLabel } from '../utils/format.js';
import { readCompareParam, resolveBaseSnapshotId, withCompareParam } from './compare.js';
import type { AppState } from './state.js';
import { setServerStatus, ServerStatusSetter } from './ui.js';

export type SnapshotApi = Pick<
  typeof snapshotApi,
  'fetchSnapshotList' | 'fetchSnapshotById' | 'fetchLatestSnapshot' | 'fetchStaticSnapshot'
>;
export type SnapshotHeader = Pick<
  HeaderStatusBarComponent,
  'setScanAvailable' | 'setSnapshots' | 'setSseStatus' | 'setCompareOptions'
>;
/** `?compare=` в адресной строке: прочитать при старте и переписать при выборе базы. */
export interface CompareUrl {
  read: () => string | null;
  write: (compareId: string | null) => void;
}
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
  compareUrl?: CompareUrl;
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
  private readonly compareUrl: CompareUrl;

  constructor(deps: SnapshotControllerDeps) {
    this.state = deps.state;
    this.header = deps.header;
    this.connectLive = deps.connectLive;
    this.onApply = deps.onApply;
    this.api = deps.api ?? snapshotApi;
    this.setServerStatus = deps.setServerStatus ?? setServerStatus;
    this.getSelect = deps.getSelect ?? (() => document.getElementById('snapshot-select') as HTMLSelectElement | null);
    this.animateTransition = deps.animateTransition ?? triggerSnapshotTransitionAnimation;
    this.compareUrl = deps.compareUrl ?? browserCompareUrl;
  }

  async fetchSnapshots(): Promise<void> {
    const list = await this.api.fetchSnapshotList();
    // /api/snapshots недоступен — статика (GitHub Pages) или сервер лежит: запускать скан некуда
    this.state.apiAvailable = list !== null;
    this.header.setScanAvailable(list !== null);
    if (list) {
      // SSE только при живом API: на статике /api/events нет, и EventSource ретраил бы его бесконечно
      this.connectLive();
      this.state.snapshotsList = list;
      this.setServerStatus(true, 'HTTP :4200 (Online)');

      if (this.state.snapshotsList.length > 0) {
        this.populateSnapshotSelect();
        // Срез из ссылки, которого нет в истории (удалён, опечатка), — молча сравниваем с предыдущим
        const requested = this.compareUrl.read();
        this.state.compareId = requested && list.some(s => s.id === requested) ? requested : null;
        if (requested && !this.state.compareId) this.compareUrl.write(null);
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

        // Базой стал сам текущий срез — возвращаемся к «предыдущему»
        if (this.state.compareId === snapshotId) {
          this.state.compareId = null;
          this.compareUrl.write(null);
        }
        await this.loadBaseSnapshot();

        if (animate) {
          this.animateTransition();
        }

        this.onApply();
      }
    } catch (err) {
      console.error('Failed to load snapshot:', err);
    }
  }

  /** Выбор в «Сравнить с»: null — предыдущий срез. Пишется в URL, экран перерисовывается с новой базой. */
  async selectCompare(compareId: string | null): Promise<void> {
    this.state.compareId = compareId && compareId !== this.state.currentSnapshotId ? compareId : null;
    this.compareUrl.write(this.state.compareId);
    await this.loadBaseSnapshot();
    this.onApply();
  }

  private async loadBaseSnapshot(): Promise<void> {
    const list = this.state.snapshotsList;
    const baseId = resolveBaseSnapshotId(list, this.state.currentSnapshotId, this.state.compareId);
    // Сбой загрузки базы не мешает показать текущий срез
    const base = baseId
      ? await this.api.fetchSnapshotById(baseId, this.state.snapshotsCache).catch(() => undefined)
      : undefined;
    this.state.baseSnapshot = base || null;
    this.populateCompareSelect();
  }

  /** Опции «Сравнить с»: «Предыдущий» и все срезы, кроме текущего. Скрыт, если сравнивать не с чем. */
  private populateCompareSelect(): void {
    const others = this.state.snapshotsList.filter(s => s.id !== this.state.currentSnapshotId);
    const options = others.map(s => ({ id: s.id, label: formatSnapshotOptionLabel(s.date, s.totalGamesScanned) }));
    this.header.setCompareOptions(options, this.state.compareId, this.state.apiAvailable && others.length > 0);
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

const browserCompareUrl: CompareUrl = {
  read: () => (typeof window === 'undefined' ? null : readCompareParam(window.location.search)),
  write: compareId => {
    if (typeof window === 'undefined') return;
    window.history.replaceState(window.history.state, '', withCompareParam(window.location.href, compareId));
  },
};

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
