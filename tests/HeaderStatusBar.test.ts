import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  HeaderStatusBarComponent,
  formatCompactCcu,
  formatMinutesAgo,
  HeaderKpiData,
} from '../web/src/components/HeaderStatusBar.js';

interface MockElement {
  id: string;
  tagName: string;
  style: Record<string, any>;
  classList: {
    classes: Set<string>;
    add: (c: string) => void;
    remove: (c: string) => void;
    toggle: (c: string, force?: boolean) => boolean;
    contains: (c: string) => boolean;
  };
  attributes: Record<string, string>;
  getAttribute: (name: string) => string | null;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
  listeners: Record<string, ((e: any) => void)[]>;
  addEventListener: (event: string, handler: (e: any) => void) => void;
  removeEventListener: (event: string, handler: (e: any) => void) => void;
  click: () => void;
  dispatchEvent: (e: any) => void;
  textContent: string;
  innerHTML: string;
  value: string;
  disabled: boolean;
  options: { value: string; textContent: string; selected?: boolean }[];
  appendChild: (child: any) => void;
}

function createMockElement(id: string, tagName = 'DIV'): MockElement {
  const classes = new Set<string>();
  const listeners: Record<string, ((e: any) => void)[]> = {};
  const attributes: Record<string, string> = {};
  const optionsList: any[] = [];

  const el: MockElement = {
    id,
    tagName,
    style: {},
    attributes,
    getAttribute: (name: string) => attributes[name] ?? null,
    setAttribute: (name: string, value: string) => {
      attributes[name] = value;
    },
    removeAttribute: (name: string) => {
      delete attributes[name];
    },
    textContent: '',
    innerHTML: '',
    value: '',
    disabled: false,
    options: optionsList,
    appendChild: (child: any) => {
      optionsList.push(child);
    },
    classList: {
      classes,
      add: (c: string) => classes.add(c),
      remove: (c: string) => classes.delete(c),
      toggle: (c: string, force?: boolean) => {
        if (force === true) {
          classes.add(c);
          return true;
        } else if (force === false) {
          classes.delete(c);
          return false;
        }
        if (classes.has(c)) {
          classes.delete(c);
          return false;
        } else {
          classes.add(c);
          return true;
        }
      },
      contains: (c: string) => classes.has(c),
    },
    listeners,
    addEventListener: (event: string, handler: (e: any) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    removeEventListener: (event: string, handler: (e: any) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== handler);
      }
    },
    click: () => {
      if (listeners['click']) {
        listeners['click'].forEach(h => h({ stopPropagation: () => {}, target: el }));
      }
    },
    dispatchEvent: (e: any) => {
      if (listeners[e.type]) {
        listeners[e.type].forEach(h => h(e));
      }
    },
  };

  return el;
}

describe('HeaderStatusBar Component & Utility Functions (TDD)', () => {
  describe('formatCompactCcu', () => {
    it('должен форматировать миллионы с суффиксом M и одной десятой', () => {
      expect(formatCompactCcu(1_420_000)).toBe('1.42M');
      expect(formatCompactCcu(1_000_000)).toBe('1.00M');
      expect(formatCompactCcu(2_824_620)).toBe('2.82M');
    });

    it('должен форматировать тысячи с суффиксом k', () => {
      expect(formatCompactCcu(546_396)).toBe('546.4k');
      expect(formatCompactCcu(12_500)).toBe('12.5k');
      expect(formatCompactCcu(1_000)).toBe('1.0k');
    });

    it('должен возвращать число без изменений для значений меньше 1000', () => {
      expect(formatCompactCcu(473)).toBe('473');
      expect(formatCompactCcu(0)).toBe('0');
    });
  });

  describe('formatMinutesAgo', () => {
    it('должен возвращать "Только что" для нулевой или отрицательной разницы', () => {
      const now = new Date();
      expect(formatMinutesAgo(now.toISOString(), now)).toBe('Только что');
    });

    it('должен возвращать количество минут назад', () => {
      const base = new Date('2026-10-03T12:00:00Z');
      const fiveMinsAgo = new Date('2026-10-03T11:55:00Z');
      expect(formatMinutesAgo(fiveMinsAgo.toISOString(), base)).toBe('5 мин назад');
    });

    it('должен возвращать часы, если прошло более 60 минут', () => {
      const base = new Date('2026-10-03T14:00:00Z');
      const twoHoursAgo = new Date('2026-10-03T12:00:00Z');
      expect(formatMinutesAgo(twoHoursAgo.toISOString(), base)).toBe('2 ч назад');
    });
  });

  describe('HeaderStatusBarComponent DOM Interaction', () => {
    let elements: Map<string, MockElement>;
    let docListeners: Record<string, ((e: any) => void)[]>;

    beforeEach(() => {
      elements = new Map();
      docListeners = {};

      const ids = [
        'btn-live-scan',
        'snapshot-select',
        'export-dropdown-wrapper',
        'btn-export-dropdown',
        'btn-export-md',
        'btn-export-json',
        'status-led',
        'sse-label',
        'kpi-total-games',
        'kpi-total-ccu',
        'kpi-arbitrage-count',
        'kpi-top-game',
        'kpi-updated-time',
        'btn-sound-toggle',
        'site-header',
        'header-progress-bar',
        'header-progress-inner',
        'header-progress-label',
        'scan-overlay',
        'scan-progress-inner',
        'scan-phase-text',
      ];

      for (const id of ids) {
        elements.set(id, createMockElement(id));
      }

      vi.stubGlobal('document', {
        getElementById: (id: string) => elements.get(id) || null,
        querySelector: (sel: string) => {
          if (sel.startsWith('#')) return elements.get(sel.slice(1)) || null;
          return null;
        },
        createElement: (tag: string) => createMockElement(`created-${tag}`, tag),
        addEventListener: (event: string, handler: (e: any) => void) => {
          if (!docListeners[event]) docListeners[event] = [];
          docListeners[event].push(handler);
        },
        removeEventListener: (event: string, handler: (e: any) => void) => {
          if (docListeners[event]) {
            docListeners[event] = docListeners[event].filter(h => h !== handler);
          }
        },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('должен инициировать сканирование при клике на кнопку скан', () => {
      const onScan = vi.fn();
      const component = new HeaderStatusBarComponent({
        onScan,
        onSnapshotSelect: vi.fn(),
        onExport: vi.fn(),
      });

      const btnScan = elements.get('btn-live-scan')!;
      btnScan.click();

      expect(onScan).toHaveBeenCalledTimes(1);
    });

    it('должен вызывать onSnapshotSelect при смене среза в селекторе', () => {
      const onSnapshotSelect = vi.fn();
      const component = new HeaderStatusBarComponent({
        onScan: vi.fn(),
        onSnapshotSelect,
        onExport: vi.fn(),
      });

      const select = elements.get('snapshot-select')!;
      select.value = 'snapshot-2026-10-02';
      select.dispatchEvent({ type: 'change', target: { value: 'snapshot-2026-10-02' } });

      expect(onSnapshotSelect).toHaveBeenCalledWith('snapshot-2026-10-02');
    });

    it('должен управлять выпадающим меню экспорта и вызывать onExport для md и json', () => {
      const onExport = vi.fn();
      const component = new HeaderStatusBarComponent({
        onScan: vi.fn(),
        onSnapshotSelect: vi.fn(),
        onExport,
      });

      const dropdownWrapper = elements.get('export-dropdown-wrapper')!;
      const btnDropdown = elements.get('btn-export-dropdown')!;
      const btnMd = elements.get('btn-export-md')!;
      const btnJson = elements.get('btn-export-json')!;

      // Открываем меню
      btnDropdown.click();
      expect(dropdownWrapper.classList.contains('open')).toBe(true);

      // Клик по md
      btnMd.click();
      expect(onExport).toHaveBeenCalledWith('md');
      expect(dropdownWrapper.classList.contains('open')).toBe(false);

      // Открываем снова и клик по json
      btnDropdown.click();
      expect(dropdownWrapper.classList.contains('open')).toBe(true);
      btnJson.click();
      expect(onExport).toHaveBeenCalledWith('json');
      expect(dropdownWrapper.classList.contains('open')).toBe(false);
    });

    it('должен корректно переключать светодиод SSE статуса (connected/offline)', () => {
      const component = new HeaderStatusBarComponent({
        onScan: vi.fn(),
        onSnapshotSelect: vi.fn(),
        onExport: vi.fn(),
      });

      const led = elements.get('status-led')!;
      const label = elements.get('sse-label')!;

      // По умолчанию онлайн
      component.setSseStatus(true, 'SSE Подключено');
      expect(led.classList.contains('connected')).toBe(true);
      expect(led.classList.contains('offline')).toBe(false);
      expect(label.textContent).toBe('SSE Подключено');

      // Переключаем в оффлайн
      component.setSseStatus(false, 'Оффлайн');
      expect(led.classList.contains('connected')).toBe(false);
      expect(led.classList.contains('offline')).toBe(true);
      expect(label.textContent).toBe('Оффлайн');
    });

    it('должен отключать кнопку и менять текст во время сканирования', () => {
      const component = new HeaderStatusBarComponent({
        onScan: vi.fn(),
        onSnapshotSelect: vi.fn(),
        onExport: vi.fn(),
      });

      const btnScan = elements.get('btn-live-scan')!;

      component.setScanning(true);
      expect(btnScan.disabled).toBe(true);
      expect(btnScan.textContent).toContain('Сканирование');

      component.setScanning(false);
      expect(btnScan.disabled).toBe(false);
      expect(btnScan.textContent).toContain('Запустить скан');
    });

    it('должен заполнять список снимков в селекторе через setSnapshots', () => {
      const component = new HeaderStatusBarComponent({
        onScan: vi.fn(),
        onSnapshotSelect: vi.fn(),
        onExport: vi.fn(),
      });

      const select = elements.get('snapshot-select')!;
      component.setSnapshots([
        { id: 'snapshot-2026-10-03', label: '03.10.2026 (473 игры)' },
        { id: 'snapshot-2026-10-02', label: '02.10.2026 (460 игр)' },
      ], 'snapshot-2026-10-03');

      expect(select.options.length).toBe(2);
      expect(select.options[0].value).toBe('snapshot-2026-10-03');
      expect(select.options[0].selected).toBe(true);
    });

    it('должен обновлять значения KPI в узкой строке', () => {
      const component = new HeaderStatusBarComponent({
        onScan: vi.fn(),
        onSnapshotSelect: vi.fn(),
        onExport: vi.fn(),
      });

      const kpiData: HeaderKpiData = {
        totalGames: 473,
        totalCcu: 1_420_000,
        ccuChangePercent: 4.2,
        arbitrageCount: 14,
        topDayGameTitle: 'Steal An Egg',
        updatedText: '5 мин назад',
      };

      component.updateKpi(kpiData);

      expect(elements.get('kpi-total-games')!.textContent).toBe('473');
      expect(elements.get('kpi-total-ccu')!.textContent).toBe('1.42M (+4.2%)');
      expect(elements.get('kpi-arbitrage-count')!.textContent).toBe('14');
      expect(elements.get('kpi-top-game')!.textContent).toBe('Steal An Egg');
      expect(elements.get('kpi-updated-time')!.textContent).toBe('5 мин назад');

      // Проверка отрицательной дельты
      component.updateKpi({
        ...kpiData,
        ccuChangePercent: -2.5,
      });
      expect(elements.get('kpi-total-ccu')!.textContent).toBe('1.42M (-2.5%)');

      // Проверка нулевой дельты
      component.updateKpi({
        ...kpiData,
        ccuChangePercent: undefined,
      });
      expect(elements.get('kpi-total-ccu')!.textContent).toBe('1.42M');
    });

    it('должен вызывать onSoundToggle при клике на кнопку звука', () => {
      const onSoundToggle = vi.fn();
      const component = new HeaderStatusBarComponent({
        onScan: vi.fn(),
        onSnapshotSelect: vi.fn(),
        onExport: vi.fn(),
        onSoundToggle,
      });

      const btnSound = elements.get('btn-sound-toggle')!;
      btnSound.click();

      expect(onSoundToggle).toHaveBeenCalledTimes(1);
    });

    it('должен закрывать выпадающее меню экспорта при клике вне меню', () => {
      const component = new HeaderStatusBarComponent({
        onScan: vi.fn(),
        onSnapshotSelect: vi.fn(),
        onExport: vi.fn(),
      });

      const dropdownWrapper = elements.get('export-dropdown-wrapper')!;
      const btnDropdown = elements.get('btn-export-dropdown')!;

      // Открываем меню
      btnDropdown.click();
      expect(dropdownWrapper.classList.contains('open')).toBe(true);

      // Клик снаружи
      const outsideEl = createMockElement('outside-area');
      dropdownWrapper.contains = vi.fn().mockReturnValue(false);

      if (docListeners['click']) {
        docListeners['click'].forEach(h => h({ target: outsideEl } as any));
      }

      expect(dropdownWrapper.classList.contains('open')).toBe(false);

      // Очистка
      component.destroy();
    });

    it('должен отображать и плавно заполнять прогресс-бар в шапке при вызове setScanProgress', () => {
      const component = new HeaderStatusBarComponent({
        onScan: vi.fn(),
        onSnapshotSelect: vi.fn(),
        onExport: vi.fn(),
      });

      const progressInner = elements.get('header-progress-inner')!;
      const progressLabel = elements.get('header-progress-label')!;
      const scanProgressInner = elements.get('scan-progress-inner')!;
      const scanPhaseText = elements.get('scan-phase-text')!;

      // Прогресс 55% для Яндекс Игр
      component.setScanProgress({ source: 'yandex_games', pct: 55 });

      expect(progressInner.style.width).toBe('55%');
      expect(progressLabel.textContent).toBe('Парсинг Яндекс Игр...');
      expect(scanProgressInner.style.width).toBe('55%');
      expect(scanPhaseText.textContent).toBe('Парсинг Яндекс Игр...');

      // Прогресс 90% для YouTube Shorts
      component.setScanProgress({ source: 'youtube_shorts', pct: 90 });

      expect(progressInner.style.width).toBe('90%');
      expect(progressLabel.textContent).toBe('Анализ YouTube Shorts...');
      expect(scanProgressInner.style.width).toBe('90%');
      expect(scanPhaseText.textContent).toBe('Анализ YouTube Shorts...');

      // Сброс прогресса (null)
      component.setScanProgress(null);
      expect(progressInner.style.width).toBe('0%');
      expect(progressLabel.textContent).toBe('');

      component.destroy();
    });
  });
});

