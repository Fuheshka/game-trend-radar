/**
 * HeaderStatusBar — Компактная фиксированная шапка (48px) и узкая строка KPI (32-36px).
 *
 * Linear Acid Lime стиль:
 * - Высококонтрастная кнопка запуска скан (#e4f222)
 * - Пульсирующий LED-индикатор SSE соединения (--status-growth #27a644)
 * - Селектор исторических снимков
 * - Выпадающее меню экспорта (.md / .json)
 * - Строка ключевых KPI (Всего игр, Онлайн, Ниши арбитража, Топ дня, Обновлено)
 */

import { formatSourceLabel, ConnectionStatus } from '../services/liveEventService.js';

export interface HeaderKpiData {
  totalGames: number;
  totalCcu: number;
  ccuChangePercent?: number;
  arbitrageCount: number;
  topDayGameTitle?: string;
  updatedText?: string;
}

export interface SnapshotOption {
  id: string;
  label: string;
  date?: string;
  gamesCount?: number;
}

export interface HeaderStatusBarOptions {
  onScan: () => void;
  onSnapshotSelect: (snapshotId: string) => void;
  onExport: (format: 'md' | 'json') => void;
  onSoundToggle?: () => void;
}

/**
 * Форматирует онлайн в компактный вид (1.42M, 546.4k, 473)
 */
export function formatCompactCcu(val: number): string {
  if (val >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(2)}M`;
  }
  if (val >= 1_000) {
    return `${(val / 1_000).toFixed(1)}k`;
  }
  return String(Math.round(val));
}

/**
 * Рассчитывает время с момента обновления в человекочитаемом виде
 */
export function formatMinutesAgo(
  timestamp: string | number | Date,
  referenceDate: Date = new Date()
): string {
  const d = new Date(timestamp);
  const diffMs = referenceDate.getTime() - d.getTime();
  if (isNaN(diffMs) || diffMs <= 60_000) {
    return 'Только что';
  }
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) {
    return `${minutes} мин назад`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ч назад`;
  }
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

export class HeaderStatusBarComponent {
  private readonly options: HeaderStatusBarOptions;

  // DOM Elements
  private btnScan: HTMLButtonElement | null = null;
  private snapshotSelect: HTMLSelectElement | null = null;
  private exportDropdownWrapper: HTMLElement | null = null;
  private btnExportDropdown: HTMLElement | null = null;
  private btnExportMd: HTMLElement | null = null;
  private btnExportJson: HTMLElement | null = null;
  private statusLed: HTMLElement | null = null;
  private sseLabel: HTMLElement | null = null;

  // KPI Elements
  private kpiTotalGames: HTMLElement | null = null;
  private kpiTotalCcu: HTMLElement | null = null;
  private kpiArbitrageCount: HTMLElement | null = null;
  private kpiTopGame: HTMLElement | null = null;
  private kpiUpdatedTime: HTMLElement | null = null;

  // Sound toggle
  private btnSoundToggle: HTMLElement | null = null;

  // Header Progress Elements
  private headerProgressBar: HTMLElement | null = null;
  private headerProgressInner: HTMLElement | null = null;
  private headerProgressLabel: HTMLElement | null = null;
  private scanProgressInner: HTMLElement | null = null;
  private scanPhaseText: HTMLElement | null = null;

  private boundDocClick: (e: MouseEvent) => void;

  constructor(options: HeaderStatusBarOptions) {
    this.options = options;
    this.bindElements();
    this.attachEventListeners();
  }

  private bindElements(): void {
    this.btnScan = document.getElementById('btn-live-scan') as HTMLButtonElement | null;
    this.snapshotSelect = document.getElementById('snapshot-select') as HTMLSelectElement | null;
    this.exportDropdownWrapper = document.getElementById('export-dropdown-wrapper');
    this.btnExportDropdown = document.getElementById('btn-export-dropdown');
    this.btnExportMd = document.getElementById('btn-export-md');
    this.btnExportJson = document.getElementById('btn-export-json');
    this.statusLed = document.getElementById('status-led');
    this.sseLabel = document.getElementById('sse-label');
    this.btnSoundToggle = document.getElementById('btn-sound-toggle');

    // KPI Elements
    this.kpiTotalGames = document.getElementById('kpi-total-games');
    this.kpiTotalCcu = document.getElementById('kpi-total-ccu');
    this.kpiArbitrageCount = document.getElementById('kpi-arbitrage-count');
    this.kpiTopGame = document.getElementById('kpi-top-game');
    this.kpiUpdatedTime = document.getElementById('kpi-updated-time');

    // Progress Elements
    this.headerProgressBar = document.getElementById('header-progress-bar');
    this.headerProgressInner = document.getElementById('header-progress-inner');
    this.headerProgressLabel = document.getElementById('header-progress-label');
    this.scanProgressInner = document.getElementById('scan-progress-inner');
    this.scanPhaseText = document.getElementById('scan-phase-text');

    const header = document.getElementById('site-header');
    if (header && !this.headerProgressBar && typeof document.createElement === 'function') {
      const bar = document.createElement('div');
      bar.id = 'header-progress-bar';
      bar.className = 'header-progress-bar';
      const inner = document.createElement('div');
      inner.id = 'header-progress-inner';
      inner.className = 'header-progress-inner';
      const label = document.createElement('span');
      label.id = 'header-progress-label';
      label.className = 'header-progress-label';
      bar.appendChild(inner);
      bar.appendChild(label);
      header.appendChild(bar);
      this.headerProgressBar = bar;
      this.headerProgressInner = inner;
      this.headerProgressLabel = label;
    }
  }

  private attachEventListeners(): void {
    // Scan button
    this.btnScan?.addEventListener('click', () => {
      this.options.onScan();
    });

    // Snapshot selector
    this.snapshotSelect?.addEventListener('change', (e: Event) => {
      const val = (e.target as HTMLSelectElement).value;
      if (val) {
        this.options.onSnapshotSelect(val);
      }
    });

    // Export dropdown toggle
    this.btnExportDropdown?.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation?.();
      const isOpen = this.exportDropdownWrapper?.classList.toggle('open');
      this.btnExportDropdown?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Export items
    this.btnExportMd?.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation?.();
      this.closeExportDropdown();
      this.options.onExport('md');
    });

    this.btnExportJson?.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation?.();
      this.closeExportDropdown();
      this.options.onExport('json');
    });

    // Sound toggle
    this.btnSoundToggle?.addEventListener('click', () => {
      this.options.onSoundToggle?.();
    });

    // Close dropdown on outside click
    this.boundDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        this.exportDropdownWrapper?.classList.contains('open') &&
        target &&
        !this.exportDropdownWrapper.contains?.(target)
      ) {
        this.closeExportDropdown();
      }
    };
    document.addEventListener('click', this.boundDocClick);
  }

  public closeExportDropdown(): void {
    this.exportDropdownWrapper?.classList.remove('open');
    this.btnExportDropdown?.setAttribute('aria-expanded', 'false');
  }

  /**
   * Обновляет индикатор SSE подключения (зеленый пульсирующий LED / серый оффлайн / реконнект)
   */
  public setSseStatus(statusOrConnected: boolean | ConnectionStatus, label?: string): void {
    const isConnected = statusOrConnected === true || statusOrConnected === 'connected';
    const isReconnecting = statusOrConnected === 'reconnecting';

    if (this.statusLed) {
      if (isConnected) {
        this.statusLed.classList.add('connected');
        this.statusLed.classList.remove('offline');
        this.statusLed.classList.remove('reconnecting');
      } else if (isReconnecting) {
        this.statusLed.classList.remove('connected');
        this.statusLed.classList.add('offline');
        this.statusLed.classList.add('reconnecting');
      } else {
        this.statusLed.classList.remove('connected');
        this.statusLed.classList.remove('reconnecting');
        this.statusLed.classList.add('offline');
      }
    }

    if (this.sseLabel) {
      if (label) {
        this.sseLabel.textContent = label;
      } else if (isConnected) {
        this.sseLabel.textContent = 'SSE Live';
      } else if (isReconnecting) {
        this.sseLabel.textContent = 'Реконнект...';
      } else {
        this.sseLabel.textContent = 'Оффлайн';
      }
    }
  }

  /**
   * Управляет отображением реального прогресса сбора данных в шапке и оверлее
   */
  public setScanProgress(
    progress: { pct: number; source?: string; label?: string } | null
  ): void {
    if (!progress) {
      if (this.headerProgressBar) {
        this.headerProgressBar.classList.remove('active');
      }
      if (this.headerProgressInner) {
        this.headerProgressInner.style.width = '0%';
      }
      if (this.headerProgressLabel) {
        this.headerProgressLabel.textContent = '';
      }
      if (this.scanProgressInner) {
        this.scanProgressInner.style.width = '0%';
      }
      return;
    }

    const pct = Math.max(0, Math.min(100, Math.round(progress.pct)));
    const label =
      progress.label ??
      (progress.source ? formatSourceLabel(progress.source) : 'Сканирование рынка...');

    if (this.headerProgressBar) {
      this.headerProgressBar.classList.add('active');
    }
    if (this.headerProgressInner) {
      this.headerProgressInner.style.width = `${pct}%`;
    }
    if (this.headerProgressLabel) {
      this.headerProgressLabel.textContent = label;
    }

    // Синхронизация с модальным оверлеем сканирования (если он открыт)
    if (this.scanProgressInner) {
      this.scanProgressInner.style.width = `${pct}%`;
    }
    if (this.scanPhaseText) {
      this.scanPhaseText.textContent = label;
    }
  }

  /**
   * Управляет состоянием кнопки сканирования во время работы
   */
  public setScanning(isScanning: boolean): void {
    if (!this.btnScan) return;
    this.btnScan.disabled = isScanning;
    if (isScanning) {
      this.btnScan.textContent = '⚡ Сканирование...';
    } else {
      this.btnScan.textContent = '⚡ Запустить скан';
    }
  }

  /**
   * Заполняет выпадающий список исторических снимков
   */
  public setSnapshots(snapshots: SnapshotOption[], selectedId?: string): void {
    if (!this.snapshotSelect) return;
    this.snapshotSelect.innerHTML = '';
    for (const snap of snapshots) {
      const opt = document.createElement('option');
      opt.value = snap.id;
      opt.textContent = snap.label;
      if (snap.id === selectedId) {
        opt.selected = true;
      }
      this.snapshotSelect.appendChild(opt);
    }
    if (selectedId) {
      this.snapshotSelect.value = selectedId;
    }
  }

  /**
   * Обновляет ключевые показатели в узкой строке KPI
   */
  public updateKpi(data: HeaderKpiData): void {
    if (this.kpiTotalGames) {
      this.kpiTotalGames.textContent = String(data.totalGames);
    }

    if (this.kpiTotalCcu) {
      const formattedCcu = formatCompactCcu(data.totalCcu);
      if (data.ccuChangePercent !== undefined && data.ccuChangePercent !== 0) {
        const sign = data.ccuChangePercent > 0 ? '+' : '';
        this.kpiTotalCcu.textContent = `${formattedCcu} (${sign}${data.ccuChangePercent.toFixed(1)}%)`;
      } else {
        this.kpiTotalCcu.textContent = formattedCcu;
      }
    }

    if (this.kpiArbitrageCount) {
      this.kpiArbitrageCount.textContent = String(data.arbitrageCount);
    }

    if (this.kpiTopGame) {
      this.kpiTopGame.textContent = data.topDayGameTitle || '—';
    }

    if (this.kpiUpdatedTime) {
      this.kpiUpdatedTime.textContent = data.updatedText || 'Только что';
    }
  }

  public destroy(): void {
    document.removeEventListener('click', this.boundDocClick);
  }
}
