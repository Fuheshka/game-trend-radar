/**
 * Скан рынка и события SSE: запуск `POST /api/scan`, прогресс в шапке, оверлей у инициатора,
 * перезагрузка снимков по `scan:completed` / `snapshot:updated`.
 */
import type { HeaderStatusBarComponent } from '../components/HeaderStatusBar.js';
import type { LiveEventService, ScanProgressData, ScanCompletedData } from '../services/liveEventService.js';
import { requestScan, storeScanToken, ScanRequestResult } from '../services/snapshotApi.js';
import type { AppState } from './state.js';
import type { SnapshotController } from './snapshotController.js';
import { setServerStatus, showToast, ServerStatusSetter } from './ui.js';

export type ScanHeader = Pick<
  HeaderStatusBarComponent,
  'setSseStatus' | 'setScanAvailable' | 'setScanning' | 'setScanProgress'
>;
export type ScanLiveEvents = Pick<LiveEventService, 'onStatusChange' | 'on'>;
export type ScanSnapshots = Pick<SnapshotController, 'fetchSnapshots' | 'selectSnapshot' | 'fetchLatestSnapshot'>;

/** Оверлей скана и кнопка «Запустить скан». */
export interface ScanUi {
  setOverlay(active: boolean): void;
  setScanButtonDisabled(disabled: boolean): void;
}

export interface ScanControllerDeps {
  state: AppState;
  header: ScanHeader;
  liveEvents: ScanLiveEvents;
  snapshots: ScanSnapshots;
  onScanFinished?: () => void;
  ui?: ScanUi;
  showToast?: (message: string) => void;
  setServerStatus?: ServerStatusSetter;
  requestScan?: () => Promise<ScanRequestResult>;
  /** Запрос SCAN_TOKEN у пользователя (window.prompt). */
  promptToken?: () => string | null;
  storeScanToken?: (token: string | null) => void;
}

export const domScanUi: ScanUi = {
  setOverlay(active) {
    document.getElementById('scan-overlay')?.classList.toggle('active', active);
  },
  setScanButtonDisabled(disabled) {
    const btnScan = document.getElementById('btn-live-scan') as HTMLButtonElement | null;
    if (btnScan) btnScan.disabled = disabled;
  },
};

export class ScanController {
  private readonly state: AppState;
  private readonly header: ScanHeader;
  private readonly liveEvents: ScanLiveEvents;
  private readonly snapshots: ScanSnapshots;
  private readonly onScanFinished: () => void;
  private readonly ui: ScanUi;
  private readonly showToast: (message: string) => void;
  private readonly setServerStatus: ServerStatusSetter;
  private readonly requestScan: () => Promise<ScanRequestResult>;
  private readonly promptToken: () => string | null;
  private readonly storeScanToken: (token: string | null) => void;

  constructor(deps: ScanControllerDeps) {
    this.state = deps.state;
    this.header = deps.header;
    this.liveEvents = deps.liveEvents;
    this.snapshots = deps.snapshots;
    this.onScanFinished = deps.onScanFinished ?? (() => {});
    this.ui = deps.ui ?? domScanUi;
    this.showToast = deps.showToast ?? showToast;
    this.setServerStatus = deps.setServerStatus ?? setServerStatus;
    this.requestScan = deps.requestScan ?? requestScan;
    this.promptToken = deps.promptToken ?? (() => window.prompt('Для запуска скана нужен токен доступа (SCAN_TOKEN):'));
    this.storeScanToken = deps.storeScanToken ?? storeScanToken;
  }

  /** Подписки на SSE; само подключение делает SnapshotController, когда API доступен. */
  subscribe(): void {
    // 1. Статус подключения (connecting, connected, reconnecting, disconnected)
    this.liveEvents.onStatusChange(status => {
      this.header.setSseStatus(status);
      if (status === 'connected') {
        this.state.apiAvailable = true;
        this.header.setScanAvailable(true); // сервер поднялся после загрузки страницы
        this.setServerStatus(true, 'HTTP :4200 (SSE Live)');
      } else if (status === 'reconnecting') {
        this.setServerStatus(false, 'Реконнект к SSE...');
      } else {
        this.setServerStatus(false, 'Демонстрационный режим');
      }
    });

    // 2. Старт сканирования
    this.liveEvents.on('scan:started', () => {
      this.state.isScanning = true;
      this.header.setScanning(true);
      this.header.setScanProgress({ pct: 5, label: 'Инициализация мониторинга...' });
      // Фоновый автоскан не должен блокировать экран всем зрителям — оверлей только у инициатора
      if (this.state.localScanRequested) {
        this.ui.setOverlay(true);
      }
      this.ui.setScanButtonDisabled(true);
    });

    // Скан отклонён валидацией или упал — снимаем блокировки и объясняем причину
    this.liveEvents.on('scan:failed', (data: { error?: string }) => {
      this.state.localScanRequested = false;
      this.resetScanningState();
      this.showToast(data?.error || 'Сканирование не удалось. Прежние данные сохранены.');
    });

    // 3. Реальный прогресс сбора данных
    this.liveEvents.on('scan:progress', (data: ScanProgressData) => {
      this.header.setScanProgress(data);
    });

    // 4. Завершение сканирования
    this.liveEvents.on('scan:completed', async (data: ScanCompletedData) => {
      this.onScanFinished();
      this.state.localScanRequested = false;
      this.resetScanningState();

      this.showToast('Сканирование завершено! Снимок обновлен.');

      // Автоматически обновляем срезы и применяем свежие данные ко всем вкладкам
      await this.snapshots.fetchSnapshots();
      if (data.snapshotId) {
        await this.snapshots.selectSnapshot(data.snapshotId, false);
      } else {
        await this.snapshots.fetchLatestSnapshot();
      }
    });

    // 5. Фоновое обновление снимка рынка (cron / другой клиент)
    this.liveEvents.on('snapshot:updated', async data => {
      if (!this.state.isScanning) {
        await this.snapshots.fetchSnapshots();
        if (data.snapshotId && data.snapshotId !== this.state.currentSnapshotId) {
          await this.snapshots.selectSnapshot(data.snapshotId, false);
        }
      }
    });
  }

  async triggerLiveScan(): Promise<void> {
    if (this.state.isScanning) return;
    this.state.isScanning = true;
    this.header.setScanning(true);

    this.ui.setScanButtonDisabled(true);
    this.ui.setOverlay(true);

    this.header.setScanProgress({ pct: 5, label: 'Инициализация мониторинга...' });

    this.state.localScanRequested = true;
    try {
      const result = await this.requestScan();
      if (result.kind === 'unauthorized') {
        const entered = this.promptToken();
        this.storeScanToken(entered);
        this.showToast(entered ? 'Токен сохранён — нажмите «Запустить скан» ещё раз.' : 'Нужен токен доступа.');
        this.cancelLocalScan();
      } else if (result.kind === 'disabled') {
        this.showToast('Ручной скан отключён на сервере. Данные обновляются автосканом.');
        this.cancelLocalScan();
      } else if (result.kind === 'cooldown') {
        this.showToast(`Скан недавно выполнялся. Повторите через ${result.retryAfterSec} с.`);
        this.cancelLocalScan();
      } else if (result.kind === 'error') {
        this.showToast('Сервер вернул ошибку при сканировании.');
        this.cancelLocalScan();
      }
      // Ход и завершение транслируются через SSE (scan:progress, scan:completed, scan:failed)
    } catch (err) {
      console.warn('[App] Ошибка запуска POST /api/scan:', err);
      this.showToast('Сервер недоступен для запуска сканирования.');
      this.cancelLocalScan();
    }
  }

  private cancelLocalScan(): void {
    this.state.localScanRequested = false;
    this.resetScanningState();
  }

  private resetScanningState(): void {
    this.ui.setOverlay(false);
    this.ui.setScanButtonDisabled(false);
    this.state.isScanning = false;
    this.header.setScanning(false);
    this.header.setScanProgress(null);
  }
}
