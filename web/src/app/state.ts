/**
 * Общее состояние дашборда — один явный объект, который main.ts создаёт и передаёт контроллерам.
 * Контроллеры читают и меняют его поля; DOM и компоненты остаются за самими контроллерами.
 */
import { MarketSnapshot, SnapshotSummary } from '../types.js';
import { FALLBACK_SNAPSHOT } from '../fallbackData.js';
import type { WorkspaceId } from '../components/WorkspaceTabs.js';
import type { RadarFilters } from './verdictFilters.js';

export interface AppState {
  /** Снимок на экране; до загрузки — встроенные демо-данные. */
  snapshot: MarketSnapshot;
  /** Предыдущий срез истории для дельт («было/стало»); null — истории нет. */
  previousSnapshot: MarketSnapshot | null;
  snapshotsList: SnapshotSummary[];
  snapshotsCache: Map<string, MarketSnapshot>;
  currentSnapshotId: string;
  /** Фильтры вкладки «Радар». */
  filters: RadarFilters;
  /** /api/snapshots ответил: работаем с сервером, а не со статикой Pages или демо. */
  apiAvailable: boolean;
  isScanning: boolean;
  /** Скан запущен из этой вкладки браузера: только инициатору показываем оверлей. */
  localScanRequested: boolean;
  currentView: WorkspaceId;
}

export function createAppState(): AppState {
  return {
    snapshot: FALLBACK_SNAPSHOT,
    previousSnapshot: null,
    snapshotsList: [],
    snapshotsCache: new Map(),
    currentSnapshotId: '',
    filters: {
      platform: 'all',
      status: 'all',
      archetype: null,
      searchQuery: '',
      sortBy: 'score_desc',
    },
    apiAvailable: false,
    isScanning: false,
    localScanRequested: false,
    currentView: 'radar',
  };
}
