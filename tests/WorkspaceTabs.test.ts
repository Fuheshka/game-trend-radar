import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceTabsComponent, WorkspaceId } from '../web/src/components/WorkspaceTabs.js';

interface MockElement {
  id: string;
  style: { display: string; [key: string]: any };
  classList: {
    classes: Set<string>;
    add: (c: string) => void;
    remove: (c: string) => void;
    toggle: (c: string, force?: boolean) => boolean;
    contains: (c: string) => boolean;
  };
  listeners: Record<string, ((e: any) => void)[]>;
  addEventListener: (event: string, handler: (e: any) => void) => void;
  removeEventListener: (event: string, handler: (e: any) => void) => void;
  click: () => void;
  dispatchEvent: (e: any) => void;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  tagName: string;
}

function createMockElement(id: string, tagName = 'DIV'): MockElement {
  const classes = new Set<string>();
  const listeners: Record<string, ((e: any) => void)[]> = {};

  const el: MockElement = {
    id,
    tagName,
    style: { display: 'none' },
    scrollTop: 0,
    scrollHeight: 500,
    clientHeight: 500,
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
      listeners['click']?.forEach(h => h({ target: el }));
    },
    dispatchEvent: (e: any) => {
      listeners[e.type]?.forEach(h => h(e));
    },
  };
  return el;
}

describe('WorkspaceTabsComponent (Сегментированные табы и изолированные экраны)', () => {
  let elements: Map<string, MockElement>;
  let windowListeners: Record<string, ((e: any) => void)[]>;
  let onSwitchMock: (w: WorkspaceId) => void;
  let onEscapeMock: () => void;
  let tabsComponent: WorkspaceTabsComponent;

  beforeEach(() => {
    elements = new Map();
    windowListeners = {};
    onSwitchMock = vi.fn();
    onEscapeMock = vi.fn();

    // Create tab buttons
    const btnRadar = createMockElement('tab-btn-radar', 'BUTTON');
    const btnMovers = createMockElement('tab-btn-movers', 'BUTTON');
    const btnCatalog = createMockElement('tab-btn-catalog', 'BUTTON');
    const btnArbitrage = createMockElement('tab-btn-arbitrage', 'BUTTON');

    // Create view panels
    const panelRadar = createMockElement('view-radar', 'SECTION');
    const panelMovers = createMockElement('view-movers', 'SECTION');
    const panelCatalog = createMockElement('view-catalog', 'SECTION');
    const panelArbitrage = createMockElement('view-arbitrage', 'SECTION');

    elements.set('tab-btn-radar', btnRadar);
    elements.set('tab-btn-movers', btnMovers);
    elements.set('tab-btn-catalog', btnCatalog);
    elements.set('tab-btn-arbitrage', btnArbitrage);

    elements.set('view-radar', panelRadar);
    elements.set('view-movers', panelMovers);
    elements.set('view-catalog', panelCatalog);
    elements.set('view-arbitrage', panelArbitrage);

    // Mock document
    (globalThis as any).document = {
      getElementById: (id: string) => elements.get(id) || null,
    };

    // Mock window
    (globalThis as any).window = {
      scrollY: 0,
      scrollTo: vi.fn(),
      addEventListener: (event: string, handler: (e: any) => void) => {
        if (!windowListeners[event]) windowListeners[event] = [];
        windowListeners[event].push(handler);
      },
      removeEventListener: (event: string, handler: (e: any) => void) => {
        if (windowListeners[event]) {
          windowListeners[event] = windowListeners[event].filter(h => h !== handler);
        }
      },
      dispatchEvent: (e: any) => {
        windowListeners[e.type]?.forEach(h => h(e));
      },
    };

    (globalThis as any).requestAnimationFrame = (cb: () => void) => cb();
  });

  afterEach(() => {
    tabsComponent?.destroy();
    vi.restoreAllMocks();
  });

  it('1. Инициализирует таб "radar" по умолчанию (активна вкладка 1, панель 1 видима, остальные скрыты)', () => {
    tabsComponent = new WorkspaceTabsComponent({
      onSwitch: onSwitchMock,
      onEscape: onEscapeMock,
    });

    expect(tabsComponent.getCurrent()).toBe('radar');

    const radarBtn = elements.get('tab-btn-radar')!;
    const moversBtn = elements.get('tab-btn-movers')!;
    const radarPanel = elements.get('view-radar')!;
    const moversPanel = elements.get('view-movers')!;

    expect(radarBtn.classList.contains('active')).toBe(true);
    expect(moversBtn.classList.contains('active')).toBe(false);
    expect(radarPanel.style.display).toBe('block');
    expect(moversPanel.style.display).toBe('none');
  });

  it('2. Переключает экран по клику мыши на кнопку таба и вызывает onSwitch', () => {
    tabsComponent = new WorkspaceTabsComponent({
      onSwitch: onSwitchMock,
      onEscape: onEscapeMock,
    });

    const catalogBtn = elements.get('tab-btn-catalog')!;
    catalogBtn.click();

    expect(tabsComponent.getCurrent()).toBe('catalog');
    expect(onSwitchMock).toHaveBeenCalledWith('catalog');

    const radarPanel = elements.get('view-radar')!;
    const catalogPanel = elements.get('view-catalog')!;
    const catalogBtnEl = elements.get('tab-btn-catalog')!;

    expect(radarPanel.style.display).toBe('none');
    expect(catalogPanel.style.display).toBe('block');
    expect(catalogBtnEl.classList.contains('active')).toBe(true);
  });

  it('3. Переключает экраны по нажатию цифровых клавиш 1, 2, 3, 4', () => {
    tabsComponent = new WorkspaceTabsComponent({
      onSwitch: onSwitchMock,
      onEscape: onEscapeMock,
    });

    // Нажатие 2 -> movers
    const keyEvent2 = { key: '2', type: 'keydown', target: { tagName: 'BODY' }, preventDefault: vi.fn() };
    (globalThis as any).window.dispatchEvent(keyEvent2);
    expect(tabsComponent.getCurrent()).toBe('movers');
    expect(elements.get('view-movers')!.style.display).toBe('block');
    expect(elements.get('view-radar')!.style.display).toBe('none');

    // Нажатие 3 -> catalog
    const keyEvent3 = { key: '3', type: 'keydown', target: { tagName: 'BODY' }, preventDefault: vi.fn() };
    (globalThis as any).window.dispatchEvent(keyEvent3);
    expect(tabsComponent.getCurrent()).toBe('catalog');
    expect(elements.get('view-catalog')!.style.display).toBe('block');

    // Нажатие 4 -> arbitrage
    const keyEvent4 = { key: '4', type: 'keydown', target: { tagName: 'BODY' }, preventDefault: vi.fn() };
    (globalThis as any).window.dispatchEvent(keyEvent4);
    expect(tabsComponent.getCurrent()).toBe('arbitrage');
    expect(elements.get('view-arbitrage')!.style.display).toBe('block');

    // Нажатие 1 -> radar
    const keyEvent1 = { key: '1', type: 'keydown', target: { tagName: 'BODY' }, preventDefault: vi.fn() };
    (globalThis as any).window.dispatchEvent(keyEvent1);
    expect(tabsComponent.getCurrent()).toBe('radar');
    expect(elements.get('view-radar')!.style.display).toBe('block');
  });

  it('4. Игнорирует цифровые клавиши, если фокус находится в поле ввода (input / textarea / select)', () => {
    tabsComponent = new WorkspaceTabsComponent({
      onSwitch: onSwitchMock,
      onEscape: onEscapeMock,
    });

    const inputKeyEvent = { key: '2', type: 'keydown', target: { tagName: 'INPUT' }, preventDefault: vi.fn() };
    (globalThis as any).window.dispatchEvent(inputKeyEvent);

    expect(tabsComponent.getCurrent()).toBe('radar');
    expect(onSwitchMock).not.toHaveBeenCalled();

    const textareaKeyEvent = { key: '3', type: 'keydown', target: { tagName: 'TEXTAREA' }, preventDefault: vi.fn() };
    (globalThis as any).window.dispatchEvent(textareaKeyEvent);
    expect(tabsComponent.getCurrent()).toBe('radar');
  });

  it('5. Игнорирует клавиши с модификаторами (Ctrl+1, Meta+2, Alt+3)', () => {
    tabsComponent = new WorkspaceTabsComponent({
      onSwitch: onSwitchMock,
      onEscape: onEscapeMock,
    });

    (globalThis as any).window.dispatchEvent({ key: '2', type: 'keydown', ctrlKey: true, target: { tagName: 'BODY' } });
    expect(tabsComponent.getCurrent()).toBe('radar');

    (globalThis as any).window.dispatchEvent({ key: '3', type: 'keydown', metaKey: true, target: { tagName: 'BODY' } });
    expect(tabsComponent.getCurrent()).toBe('radar');

    (globalThis as any).window.dispatchEvent({ key: '4', type: 'keydown', altKey: true, target: { tagName: 'BODY' } });
    expect(tabsComponent.getCurrent()).toBe('radar');
  });

  it('6. Вызывает onEscape при нажатии клавиши Escape', () => {
    tabsComponent = new WorkspaceTabsComponent({
      onSwitch: onSwitchMock,
      onEscape: onEscapeMock,
    });

    (globalThis as any).window.dispatchEvent({ key: 'Escape', type: 'keydown', target: { tagName: 'BODY' } });
    expect(onEscapeMock).toHaveBeenCalledTimes(1);
  });

  it('7. Сохраняет и восстанавливает позицию скролла экрана при переключении', () => {
    tabsComponent = new WorkspaceTabsComponent({
      onSwitch: onSwitchMock,
      onEscape: onEscapeMock,
    });

    // Имитируем скролл на radar
    (globalThis as any).window.scrollY = 350;

    // Переключаемся на movers
    tabsComponent.switchTo('movers');
    expect(tabsComponent.getCurrent()).toBe('movers');

    // Имитируем скролл на movers
    (globalThis as any).window.scrollY = 120;

    // Переключаемся обратно на radar — должен восстановиться скролл 350
    tabsComponent.switchTo('radar');
    expect((globalThis as any).window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 350 }));
  });
});
