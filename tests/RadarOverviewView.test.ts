import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RadarOverviewViewComponent, RadarOverviewViewOptions } from '../web/src/components/RadarOverviewView.js';
import { MarketVerdict, GameArchetype } from '../web/src/types.js';

interface MockDOMElement {
  id: string;
  tagName: string;
  className: string;
  style: Record<string, any>;
  children: MockDOMElement[];
  innerHTML: string;
  textContent: string;
  parentNode: MockDOMElement | null;
  attributes: Record<string, string>;
  listeners: Record<string, ((e: any) => void)[]>;
  setAttribute: (key: string, val: string) => void;
  getAttribute: (key: string) => string | null;
  removeAttribute: (key: string) => void;
  appendChild: (child: MockDOMElement) => MockDOMElement;
  removeChild: (child: MockDOMElement) => MockDOMElement;
  querySelector: (sel: string) => MockDOMElement | null;
  querySelectorAll: (sel: string) => MockDOMElement[];
  closest: (sel: string) => MockDOMElement | null;
  addEventListener: (event: string, handler: (e: any) => void) => void;
  removeEventListener: (event: string, handler: (e: any) => void) => void;
  dispatchEvent: (event: any) => void;
  classList: {
    add: (...classes: string[]) => void;
    remove: (...classes: string[]) => void;
    toggle: (c: string, force?: boolean) => boolean;
    contains: (c: string) => boolean;
  };
  scrollIntoView: (options?: any) => void;
}

function createMockDOM(tag: string = 'div', id: string = ''): MockDOMElement {
  const classes = new Set<string>();
  const listeners: Record<string, ((e: any) => void)[]> = {};
  const attrs: Record<string, string> = {};
  const children: MockDOMElement[] = [];
  let _className = '';
  let _innerHTML = '';

  const el: MockDOMElement = {
    id,
    tagName: tag.toUpperCase(),
    style: {},
    children,
    textContent: '',
    parentNode: null,
    attributes: attrs,
    listeners,
    setAttribute(k, v) {
      attrs[k] = v;
      if (k === 'id') el.id = v;
      if (k === 'class') {
        el.className = v;
      }
    },
    getAttribute(k) {
      if (k === 'id') return el.id || null;
      if (k === 'class') return el.className || null;
      return attrs[k] ?? null;
    },
    removeAttribute(k) {
      delete attrs[k];
    },
    appendChild(child) {
      child.parentNode = el;
      children.push(child);
      return child;
    },
    removeChild(child) {
      const idx = children.indexOf(child);
      if (idx !== -1) {
        children.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    },
    querySelector(sel: string): MockDOMElement | null {
      const results = el.querySelectorAll(sel);
      if (results.length > 0) return results[0];
      if (sel === '.btn-generate-ai-spec' && _innerHTML.includes('btn-generate-ai-spec')) {
        const archMatch = _innerHTML.match(/data-archetype="([^"]+)"/);
        const btn = createMockDOM('button');
        btn.className = 'btn-generate-ai-spec';
        if (archMatch) btn.setAttribute('data-archetype', archMatch[1]);
        btn.parentNode = el;
        return btn;
      }
      return null;
    },
    querySelectorAll(sel: string): MockDOMElement[] {
      const matched: MockDOMElement[] = [];
      const traverse = (node: MockDOMElement) => {
        for (const child of node.children) {
          if (matchesSelector(child, sel)) {
            matched.push(child);
          }
          traverse(child);
        }
      };
      traverse(el);
      return matched;
    },
    closest(sel: string): MockDOMElement | null {
      let curr: MockDOMElement | null = el;
      while (curr) {
        if (matchesSelector(curr, sel)) return curr;
        curr = curr.parentNode;
      }
      return null;
    },
    addEventListener(event, handler) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    removeEventListener(event, handler) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(h => h !== handler);
    },
    dispatchEvent(event) {
      const handlers = listeners[event.type] || [];
      for (const h of handlers) h(event);
    },
    classList: {
      add(...cs: string[]) {
        cs.forEach(c => classes.add(c));
        _className = Array.from(classes).join(' ');
      },
      remove(...cs: string[]) {
        cs.forEach(c => classes.delete(c));
        _className = Array.from(classes).join(' ');
      },
      toggle(c: string, force?: boolean) {
        let res: boolean;
        if (force === true) {
          classes.add(c);
          res = true;
        } else if (force === false) {
          classes.delete(c);
          res = false;
        } else if (classes.has(c)) {
          classes.delete(c);
          res = false;
        } else {
          classes.add(c);
          res = true;
        }
        _className = Array.from(classes).join(' ');
        return res;
      },
      contains(c: string) {
        return classes.has(c);
      },
    },
    scrollIntoView: vi.fn(),
  } as any;

  Object.defineProperty(el, 'className', {
    get: () => _className,
    set: (val: string) => {
      _className = val || '';
      classes.clear();
      _className.split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
    },
  });

  Object.defineProperty(el, 'innerHTML', {
    get: () => _innerHTML,
    set: (val: string) => {
      _innerHTML = val || '';
      if (!_innerHTML) {
        children.length = 0;
      }
    },
  });

  return el;
}

function matchesSelector(el: MockDOMElement, sel: string): boolean {
  if (sel.includes('.verdict-card') && sel.includes('[data-archetype=')) {
    const match = sel.match(/\[data-archetype="?([^"\]]+)"?\]/);
    return el.classList.contains('verdict-card') && Boolean(match && el.getAttribute('data-archetype') === match[1]);
  }
  if (sel.startsWith('#')) {
    return el.id === sel.slice(1);
  }
  if (sel.startsWith('.')) {
    const cls = sel.slice(1);
    return el.classList.contains(cls);
  }
  if (sel.startsWith('[data-archetype=')) {
    const match = sel.match(/\[data-archetype="?([^"\]]+)"?\]/);
    if (match) {
      return el.getAttribute('data-archetype') === match[1];
    }
  }
  return el.tagName.toLowerCase() === sel.toLowerCase();
}

describe('RadarOverviewViewComponent (Двухколоночный сплит-экран)', () => {
  let mockContainer: MockDOMElement;

  const mockVerdicts: MarketVerdict[] = [
    {
      archetype: 'SIMULATION_INCREMENTAL',
      titleRu: 'Симуляторы роста',
      status: 'GREEN_LIGHT',
      opportunityScore: {
        overallScore: 88,
        demandScore: 92,
        velocityScore: 85,
        monetizationScore: 87,
        saturationIndex: 2.1,
        productionEffort: 2.0,
        viralMultiplier: 1.4,
      },
      totalAudienceCCU: 1250000,
      marketSharePercent: 28,
      sampleTitles: ['Steal An Egg', 'Grow Stronger', 'Pet Simulator 99'],
      actionRecommendation: 'Запускать клон с адаптацией под веб',
      coreLoopBlueprint: 'Сбор ресурсов -> Апгрейд инвентаря -> Перерождение',
      monetizationStrategy: 'Rewarded video за ускорение x2',
      avoidPitfalls: 'Перегруженный интерфейс новичка',
    },
    {
      archetype: 'HORROR_MULTIPLAYER',
      titleRu: 'Кооперативные хорроры',
      status: 'YELLOW_LIGHT',
      opportunityScore: {
        overallScore: 72,
        demandScore: 78,
        velocityScore: 70,
        monetizationScore: 74,
        saturationIndex: 2.8,
        productionEffort: 3.2,
        viralMultiplier: 1.2,
      },
      totalAudienceCCU: 680000,
      marketSharePercent: 15,
      sampleTitles: ['Doors', 'Pressure', 'Fisch Horror'],
      actionRecommendation: 'Фокус на стримерский виральный геймплей',
      coreLoopBlueprint: 'Исследование комнат -> Бегство от монстра -> Сбор ключей',
      monetizationStrategy: 'Косметика и скины фонариков',
      avoidPitfalls: 'Слишком долгие игровые сессии',
    },
    {
      archetype: 'TYCOON_MANAGEMENT',
      titleRu: 'Тайкуны и базы',
      status: 'RED_LIGHT',
      opportunityScore: {
        overallScore: 45,
        demandScore: 50,
        velocityScore: 40,
        monetizationScore: 60,
        saturationIndex: 4.2,
        productionEffort: 3.5,
        viralMultiplier: 1.0,
      },
      totalAudienceCCU: 320000,
      marketSharePercent: 7,
      sampleTitles: ['Airport Tycoon', 'Theme Park'],
      actionRecommendation: 'Ниша перенасыщена, избегать лобовой конкуренции',
      coreLoopBlueprint: 'Покупка конвейера -> Накопление монет -> Расширение территории',
      monetizationStrategy: 'IAP авто-сборщики',
      avoidPitfalls: 'Отсутствие реиграбельности',
    },
  ];

  const mockPreviousVerdicts: MarketVerdict[] = [
    {
      ...mockVerdicts[0],
      totalAudienceCCU: 1100000, // +13.6%
    },
    {
      ...mockVerdicts[1],
      totalAudienceCCU: 720000,  // -5.6%
    },
  ];

  beforeEach(() => {
    mockContainer = createMockDOM('div', 'radar-overview-mount');
    const mockBody = createMockDOM('body');
    // Global document mock for component createElement
    (global as any).document = {
      body: mockBody,
      createElement: (tag: string) => createMockDOM(tag),
      createElementNS: (_ns: string, tag: string) => createMockDOM(tag),
      getElementById: (id: string) => {
        if (mockContainer.id === id) return mockContainer;
        return mockContainer.querySelector('#' + id);
      },
    };
    (global as any).requestAnimationFrame = vi.fn((cb: any) => setTimeout(cb, 16));
    (global as any).cancelAnimationFrame = vi.fn();
    (global as any).performance = { now: vi.fn(() => 1000) };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('должен инициализироваться и создавать двухколоночный сплит-экран (42% левая колонка, 58% правая колонка)', () => {
    const view = new RadarOverviewViewComponent({
      container: mockContainer as any,
      verdicts: mockVerdicts,
      previousVerdicts: mockPreviousVerdicts,
      activeArchetype: null,
    });

    const splitWrapper = mockContainer.querySelector('.radar-overview-split');
    expect(splitWrapper).not.toBeNull();

    const leftCol = mockContainer.querySelector('.radar-overview-col-left');
    const rightCol = mockContainer.querySelector('.radar-overview-col-right');

    expect(leftCol).not.toBeNull();
    expect(rightCol).not.toBeNull();
    expect(leftCol?.classList.contains('radar-col-42')).toBe(true);
    expect(rightCol?.classList.contains('verdicts-col-58')).toBe(true);
  });

  it('должен содержать переключатели режимов (Многоосевой радар & Доли рынка CCU) и SVG-радар', () => {
    const view = new RadarOverviewViewComponent({
      container: mockContainer as any,
      verdicts: mockVerdicts,
      previousVerdicts: mockPreviousVerdicts,
      activeArchetype: null,
    });

    const toggleSpider = mockContainer.querySelector('.btn-mode-spider');
    const togglePolar = mockContainer.querySelector('.btn-mode-polar');
    const radarStage = mockContainer.querySelector('.radar-stage-container');

    expect(toggleSpider).not.toBeNull();
    expect(togglePolar).not.toBeNull();
    expect(radarStage).not.toBeNull();
    expect(toggleSpider?.classList.contains('active')).toBe(true);

    // Switch mode to polar
    view.setMode('polar');
    expect(togglePolar?.classList.contains('active')).toBe(true);
    expect(toggleSpider?.classList.contains('active')).toBe(false);
  });

  it('должен рендерить карточки вердиктов с тактильной структурой (Raycast) и статус-бейджами', () => {
    const view = new RadarOverviewViewComponent({
      container: mockContainer as any,
      verdicts: mockVerdicts,
      previousVerdicts: mockPreviousVerdicts,
      activeArchetype: null,
    });

    const cards = mockContainer.querySelectorAll('.verdict-card');
    expect(cards.length).toBe(mockVerdicts.length);

    // Green light card checks
    const greenCard = cards[0];
    expect(greenCard.classList.contains('status-green')).toBe(true);
    expect(greenCard.getAttribute('data-archetype')).toBe('SIMULATION_INCREMENTAL');
    expect(greenCard.innerHTML).toContain('Green Light');

    // Yellow light card checks
    const yellowCard = cards[1];
    expect(yellowCard.classList.contains('status-yellow')).toBe(true);
    expect(yellowCard.getAttribute('data-archetype')).toBe('HORROR_MULTIPLAYER');
    expect(yellowCard.innerHTML).toContain('Yellow Light');

    // Red light card checks
    const redCard = cards[2];
    expect(redCard.classList.contains('status-red')).toBe(true);
    expect(redCard.getAttribute('data-archetype')).toBe('TYCOON_MANAGEMENT');
    expect(redCard.innerHTML).toContain('Red Light');
  });

  it('каждая карточка должна содержать все обязательные поля ТЗ: название, скоринг, дельту CCU, хиты, монетизацию и кнопку ТЗ для ИИ', () => {
    new RadarOverviewViewComponent({
      container: mockContainer as any,
      verdicts: mockVerdicts,
      previousVerdicts: mockPreviousVerdicts,
      activeArchetype: null,
    });

    const firstCard = mockContainer.querySelector('.verdict-card[data-archetype="SIMULATION_INCREMENTAL"]');
    expect(firstCard).not.toBeNull();
    const html = firstCard!.innerHTML;

    // Название архетипа
    expect(html).toContain('Симуляторы роста');
    expect(html).toContain('SIMULATION_INCREMENTAL');

    // Шкала Opportunity Score
    expect(html).toContain('Opportunity Score: 88/100');

    // Дельта прироста CCU (+13.6% ▲)
    expect(html).toContain('ccu-trend-badge trend-up');
    expect(html).toContain('+13.6% ▲');

    // Ключевые хиты ниши
    expect(html).toContain('Steal An Egg');
    expect(html).toContain('Grow Stronger');

    // Стратегия монетизации
    expect(html).toContain('Rewarded video за ускорение x2');

    // Кнопка «Сгенерировать ТЗ для ИИ»
    const specBtn = firstCard!.querySelector('.btn-generate-ai-spec');
    expect(specBtn).not.toBeNull();
    expect(specBtn?.getAttribute('data-archetype')).toBe('SIMULATION_INCREMENTAL');
  });

  it('должен скроллить и подсвечивать карточку при вызове scrollToArchetype', () => {
    const view = new RadarOverviewViewComponent({
      container: mockContainer as any,
      verdicts: mockVerdicts,
      previousVerdicts: mockPreviousVerdicts,
      activeArchetype: null,
    });

    const targetCard = mockContainer.querySelector('.verdict-card[data-archetype="HORROR_MULTIPLAYER"]');
    expect(targetCard).not.toBeNull();

    view.scrollToArchetype('HORROR_MULTIPLAYER');

    expect(targetCard?.scrollIntoView).toHaveBeenCalled();
    expect(targetCard?.classList.contains('is-focused')).toBe(true);

    // Highlight should remove focus from other cards
    const firstCard = mockContainer.querySelector('.verdict-card[data-archetype="SIMULATION_INCREMENTAL"]');
    expect(firstCard?.classList.contains('is-focused')).toBe(false);
  });

  it('должен вызывать onGeneratePrompt при клике на кнопку «Сгенерировать ТЗ для ИИ»', () => {
    const onGeneratePrompt = vi.fn();

    new RadarOverviewViewComponent({
      container: mockContainer as any,
      verdicts: mockVerdicts,
      previousVerdicts: mockPreviousVerdicts,
      activeArchetype: null,
      onGeneratePrompt,
    });

    const firstCard = mockContainer.querySelector('.verdict-card[data-archetype="SIMULATION_INCREMENTAL"]');
    const specBtn = firstCard?.querySelector('.btn-generate-ai-spec');
    expect(specBtn).not.toBeNull();

    // Trigger click on spec button
    const clickHandler = specBtn?.listeners?.click?.[0];
    if (clickHandler) {
      clickHandler({ stopPropagation: vi.fn(), target: specBtn });
    } else {
      // Event delegation test on right col container
      const rightCol = mockContainer.querySelector('.radar-overview-col-right');
      const containerClickHandler = rightCol?.listeners?.click?.[0];
      expect(containerClickHandler).toBeDefined();
      containerClickHandler?.({
        stopPropagation: vi.fn(),
        target: specBtn,
      });
    }

    expect(onGeneratePrompt).toHaveBeenCalledWith('SIMULATION_INCREMENTAL');
  });

  it('должен обновлять данные при вызове updateData', () => {
    const view = new RadarOverviewViewComponent({
      container: mockContainer as any,
      verdicts: mockVerdicts,
      previousVerdicts: mockPreviousVerdicts,
      activeArchetype: null,
    });

    expect(mockContainer.querySelectorAll('.verdict-card').length).toBe(3);

    const updatedVerdicts = [mockVerdicts[0]];
    view.updateData(updatedVerdicts, mockPreviousVerdicts, null);

    expect(mockContainer.querySelectorAll('.verdict-card').length).toBe(1);
  });
});
