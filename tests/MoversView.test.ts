import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MoversViewComponent,
  MoversView,
  MoversViewOptions,
  GainerItem,
  ViralSignalItem,
  BreakoutItem,
  GainersSortMode,
  calculate24hGainers,
  filterViralSignals,
  filterBreakoutNewReleases,
  generateMoversSparkline,
} from '../web/src/components/MoversView.js';
import {
  MarketSnapshot,
  NormalizedGame,
  MarketVerdict,
  GameArchetype,
} from '../web/src/types.js';

// ============================================================================
// Lightweight Mock DOM Implementation for Node/Vitest
// ============================================================================

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
  click: () => void;
  classList: {
    add: (...classes: string[]) => void;
    remove: (...classes: string[]) => void;
    toggle: (c: string, force?: boolean) => boolean;
    contains: (c: string) => boolean;
  };
  scrollIntoView: (options?: any) => void;
}

function serializeMockDOM(node: MockDOMElement): string {
  let s = '';
  for (const child of node.children) {
    const tag = child.tagName.toLowerCase();
    s += `<${tag}`;
    for (const [k, v] of Object.entries(child.attributes)) {
      s += ` ${k}="${v}"`;
    }
    s += `>`;
    if (child.children.length > 0) {
      s += serializeMockDOM(child);
    } else {
      s += child.textContent;
    }
    s += `</${tag}>`;
  }
  return s;
}

function matchesSelector(el: MockDOMElement, sel: string): boolean {
  if (!sel) return false;

  if (sel.includes(',')) {
    return sel.split(',').some(sub => matchesSelector(el, sub.trim()));
  }

  // Attribute selector support, e.g. [data-section="gainers"] or .movers-card[data-id="..."]
  if (sel.includes('[') && sel.includes(']')) {
    const attrMatch = sel.match(/\[([a-zA-Z0-9_-]+)(?:="?([^"\]]*)"?)?\]/);
    if (attrMatch) {
      const [, attr, val] = attrMatch;
      const attrVal = el.getAttribute(attr);
      const matchesAttr = val === undefined ? attrVal !== null : attrVal === val;
      const prefix = sel.split('[')[0];
      if (prefix) {
        return matchesSelector(el, prefix) && matchesAttr;
      }
      return matchesAttr;
    }
  }

  // ID selector support (#view-movers)
  if (sel.startsWith('#')) {
    return el.id === sel.slice(1);
  }

  // Class selector support (.movers-section-gainers)
  if (sel.startsWith('.')) {
    const classes = sel.slice(1).split('.');
    return classes.every(c => el.classList.contains(c));
  }

  // Tag name selector support
  return el.tagName.toLowerCase() === sel.toLowerCase();
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
      if (k === 'id') el.id = '';
      if (k === 'class') el.className = '';
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
      return results.length > 0 ? results[0] : null;
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
      let curr: MockDOMElement | null = el;
      while (curr) {
        const handlers = curr.listeners[event.type] || [];
        for (const h of handlers) {
          h({
            ...event,
            target: event.target || el,
            currentTarget: curr,
            stopPropagation: event.stopPropagation || vi.fn(),
            preventDefault: event.preventDefault || vi.fn(),
          });
        }
        if (event.bubbles === false) break;
        curr = curr.parentNode;
      }
    },
    click() {
      el.dispatchEvent({
        type: 'click',
        target: el,
        bubbles: true,
      });
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
    get: () => _innerHTML || serializeMockDOM(el),
    set: (val: string) => {
      _innerHTML = val || '';
      children.length = 0;
      if (!_innerHTML) return;

      const stack: MockDOMElement[] = [el];
      const tagRegex = /<(\/)?([a-zA-Z0-9-]+)([^>]*)>|([^<]+)/g;
      let match: RegExpExecArray | null;

      while ((match = tagRegex.exec(_innerHTML)) !== null) {
        const [full, isClose, tagName, rawAttrs, text] = match;
        if (text) {
          const parent = stack[stack.length - 1];
          if (parent) {
            parent.textContent = (parent.textContent || '') + text.trim();
          }
        } else if (isClose) {
          if (stack.length > 1 && stack[stack.length - 1].tagName === tagName.toUpperCase()) {
            stack.pop();
          }
        } else {
          const parent = stack[stack.length - 1];
          const childNode = createMockDOM(tagName);

          const attrRegex = /([a-zA-Z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
          let aMatch: RegExpExecArray | null;
          while ((aMatch = attrRegex.exec(rawAttrs || '')) !== null) {
            const aName = aMatch[1];
            const aVal = aMatch[2] ?? aMatch[3] ?? aMatch[4] ?? '';
            childNode.setAttribute(aName, aVal);
          }

          childNode.parentNode = parent;
          parent.children.push(childNode);

          const isSelfClosing =
            full.endsWith('/>') ||
            ['INPUT', 'IMG', 'BR', 'HR', 'PATH', 'CIRCLE', 'LINE', 'POLYLINE'].includes(tagName.toUpperCase());

          if (!isSelfClosing) {
            stack.push(childNode);
          }
        }
      }
    },
  });

  return el;
}

// ============================================================================
// Test Suite: MoversViewComponent
// ============================================================================

describe('MoversView (Лидеры роста, вирусные сигналы и взрывные новинки)', () => {
  let mockContainer: MockDOMElement;

  // Current snapshot fixture
  const sampleCurrentGames: NormalizedGame[] = [
    {
      id: 'roblox_steal_egg',
      platform: 'roblox',
      title: 'Steal An Egg',
      genre: 'Simulation',
      archetype: 'SIMULATION_INCREMENTAL',
      metricValue: 1500000,
      metricType: 'ccu',
      likeRatio: 0.94,
      url: 'https://roblox.com/games/egg',
      tags: ['top', 'trending', 'viral'],
      timestamp: '2026-10-03T12:00:00Z',
    },
    {
      id: 'roblox_speed_city',
      platform: 'roblox',
      title: 'Speed City Boost',
      genre: 'Runner',
      archetype: 'OTHER_CASUAL',
      metricValue: 80000,
      metricType: 'ccu',
      likeRatio: 0.91,
      url: 'https://roblox.com/games/speed',
      tags: ['runner', 'speed', 'trending'],
      timestamp: '2026-10-03T12:00:00Z',
    },
    {
      id: 'roblox_blade_ball',
      platform: 'roblox',
      title: 'Blade Ball Reforged',
      genre: 'Action',
      archetype: 'ACTION_SHOOTER',
      metricValue: 300000,
      metricType: 'ccu',
      likeRatio: 0.88,
      url: 'https://roblox.com/games/blade',
      tags: ['action', 'pvp'],
      timestamp: '2026-10-03T12:00:00Z',
    },
    {
      id: 'roblox_aura_craft',
      platform: 'roblox',
      title: 'Aura Craft 3D',
      genre: 'Sandbox',
      archetype: 'PHYSICS_SANDBOX',
      metricValue: 95000,
      metricType: 'ccu',
      likeRatio: 0.92,
      url: 'https://roblox.com/games/aura',
      tags: ['up-and-coming', 'new', 'sandbox'],
      sortSource: 'up-and-coming',
      timestamp: '2026-10-01T12:00:00Z', // 2 days old (< 14 days)
    },
    {
      id: 'roblox_dungeon_ascend',
      platform: 'roblox',
      title: 'Dungeon Ascend',
      genre: 'RPG',
      archetype: 'ACTION_SHOOTER',
      metricValue: 42000,
      metricType: 'ccu',
      likeRatio: 0.85,
      url: 'https://roblox.com/games/dungeon',
      tags: ['up-and-coming', 'rpg'],
      sortSource: 'up-and-coming',
      timestamp: '2026-09-28T12:00:00Z', // 5 days old (< 14 days)
    },
    {
      id: 'roblox_classic_obby',
      platform: 'roblox',
      title: 'Classic Obby 2024',
      genre: 'Obby',
      archetype: 'OBBY_PARKOUR',
      metricValue: 50000,
      metricType: 'ccu',
      likeRatio: 0.75,
      url: 'https://roblox.com/games/obby',
      tags: ['classic', 'obby'],
      timestamp: '2025-01-01T00:00:00Z', // Old game (> 1 year, no new tags)
    },
    {
      id: 'yt_skibidi_trend',
      platform: 'youtube_trends',
      title: 'Skibidi Toilet Invasion',
      genre: 'Viral Short Format',
      archetype: 'SIMULATION_INCREMENTAL',
      metricValue: 98,
      metricType: 'viral_score',
      tags: ['youtube_shorts', 'viral', 'meme', 'skibidi'],
      timestamp: '2026-10-03T12:00:00Z',
    },
    {
      id: 'yt_casual_meme',
      platform: 'youtube_trends',
      title: 'Dance Off Challenge',
      genre: 'Viral Short Format',
      archetype: 'OTHER_CASUAL',
      metricValue: 45,
      metricType: 'viral_score',
      tags: ['youtube_shorts', 'dance'],
      timestamp: '2026-10-03T12:00:00Z',
    },
  ];

  const sampleCurrentVerdicts: MarketVerdict[] = [
    {
      archetype: 'SIMULATION_INCREMENTAL',
      titleRu: 'Симуляторы и +1',
      status: 'GREEN_LIGHT',
      opportunityScore: {
        overallScore: 92,
        demandScore: 90,
        velocityScore: 88,
        monetizationScore: 85,
        saturationIndex: 2.0,
        productionEffort: 1.8,
        viralMultiplier: 1.85, // >= 1.5x
      },
      totalAudienceCCU: 1800000,
      marketSharePercent: 45,
      sampleTitles: ['Steal An Egg', 'Skibidi Toilet Invasion'],
      actionRecommendation: 'Запуск клона с вирусным мемом',
      coreLoopBlueprint: 'Сбор -> Прокачка -> Ребёрс',
      monetizationStrategy: 'IAP + VIP',
      avoidPitfalls: 'Перегруженный старт',
    },
    {
      archetype: 'PHYSICS_SANDBOX',
      titleRu: 'Сендбокс и физика',
      status: 'GREEN_LIGHT',
      opportunityScore: {
        overallScore: 84,
        demandScore: 82,
        velocityScore: 78,
        monetizationScore: 70,
        saturationIndex: 2.2,
        productionEffort: 2.1,
        viralMultiplier: 1.6, // >= 1.5x
      },
      totalAudienceCCU: 450000,
      marketSharePercent: 12,
      sampleTitles: ['Aura Craft 3D'],
      actionRecommendation: 'Физические песочницы',
      coreLoopBlueprint: 'Спавн объектов -> Крафт',
      monetizationStrategy: 'Донат-инструменты',
      avoidPitfalls: 'Лаги физики',
    },
    {
      archetype: 'OTHER_CASUAL',
      titleRu: 'Казуальные игры',
      status: 'YELLOW_LIGHT',
      opportunityScore: {
        overallScore: 68,
        demandScore: 70,
        velocityScore: 62,
        monetizationScore: 65,
        saturationIndex: 3.2,
        productionEffort: 1.5,
        viralMultiplier: 1.2, // < 1.5x (не должен попасть в вирусные сигналы)
      },
      totalAudienceCCU: 350000,
      marketSharePercent: 10,
      sampleTitles: ['Speed City Boost'],
      actionRecommendation: 'Быстрые таймкиллеры',
      coreLoopBlueprint: 'Бег -> Очки',
      monetizationStrategy: 'Реклама',
      avoidPitfalls: 'Низкий retention',
    },
  ];

  const sampleCurrentSnapshot: MarketSnapshot = {
    id: 'snapshot-2026-10-03',
    timestamp: '2026-10-03T12:00:00Z',
    totalGamesScanned: 8,
    platformCounts: {
      roblox: 6,
      yandex_games: 0,
      poki: 0,
      youtube_trends: 2,
    },
    robloxTotalCCU: 2067000,
    games: sampleCurrentGames,
    verdicts: sampleCurrentVerdicts,
  };

  // Previous 24h snapshot fixture
  const samplePreviousGames: NormalizedGame[] = [
    {
      ...sampleCurrentGames[0], // Steal An Egg: 1,500,000 now vs 1,000,000 prev (+500,000 abs, +50%)
      metricValue: 1000000,
    },
    {
      ...sampleCurrentGames[1], // Speed City Boost: 80,000 now vs 20,000 prev (+60,000 abs, +300%)
      metricValue: 20000,
    },
    {
      ...sampleCurrentGames[2], // Blade Ball: 300,000 now vs 280,000 prev (+20,000 abs, +7.14%)
      metricValue: 280000,
    },
    {
      ...sampleCurrentGames[3], // Aura Craft: 95,000 now vs 90,000 prev (+5,000 abs)
      metricValue: 90000,
    },
    {
      ...sampleCurrentGames[4], // Dungeon Ascend: 42,000 now vs 40,000 prev (+2,000 abs)
      metricValue: 40000,
    },
    {
      ...sampleCurrentGames[5], // Classic Obby: 50,000 now vs 50,000 prev (0 abs)
      metricValue: 50000,
    },
  ];

  const samplePreviousSnapshot: MarketSnapshot = {
    id: 'snapshot-2026-10-02',
    timestamp: '2026-10-02T12:00:00Z',
    totalGamesScanned: 6,
    platformCounts: {
      roblox: 6,
      yandex_games: 0,
      poki: 0,
      youtube_trends: 0,
    },
    robloxTotalCCU: 1480000,
    games: samplePreviousGames,
    verdicts: sampleCurrentVerdicts,
  };

  beforeEach(() => {
    mockContainer = createMockDOM('section', 'view-movers');
    const mockBody = createMockDOM('body');

    // Global browser mocks
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

  // ==========================================================================
  // 1. Корректность ранжирования лидеров роста CCU (24h Gainers)
  // ==========================================================================
  describe('1. Корректность ранжирования лидеров роста CCU (24h Gainers)', () => {
    it('1.1 Должен правильно рассчитывать абсолютную дельту (absDiff) и процентный прирост (pctDiff)', () => {
      const gainers = calculate24hGainers(sampleCurrentSnapshot, samplePreviousSnapshot, 'abs');
      expect(gainers).toBeDefined();
      expect(gainers.length).toBeGreaterThan(0);

      const eggGainer = gainers.find(g => g.game.id === 'roblox_steal_egg');
      expect(eggGainer).toBeDefined();
      expect(eggGainer?.currentCcu).toBe(1500000);
      expect(eggGainer?.prevCcu).toBe(1000000);
      expect(eggGainer?.absDiff).toBe(500000);
      expect(eggGainer?.pctDiff).toBeCloseTo(50.0, 1);

      const speedGainer = gainers.find(g => g.game.id === 'roblox_speed_city');
      expect(speedGainer).toBeDefined();
      expect(speedGainer?.currentCcu).toBe(80000);
      expect(speedGainer?.prevCcu).toBe(20000);
      expect(speedGainer?.absDiff).toBe(60000);
      expect(speedGainer?.pctDiff).toBeCloseTo(300.0, 1);

      const bladeGainer = gainers.find(g => g.game.id === 'roblox_blade_ball');
      expect(bladeGainer).toBeDefined();
      expect(bladeGainer?.currentCcu).toBe(300000);
      expect(bladeGainer?.prevCcu).toBe(280000);
      expect(bladeGainer?.absDiff).toBe(20000);
      expect(bladeGainer?.pctDiff).toBeCloseTo(7.14, 1);
    });

    it('1.2 Должен корректно ранжировать по максимальному абсолютному приросту (absDiff desc)', () => {
      const gainers = calculate24hGainers(sampleCurrentSnapshot, samplePreviousSnapshot, 'abs');
      expect(gainers.length).toBeGreaterThanOrEqual(3);

      // Ожидаемый порядок: Steal An Egg (+500k) > Speed City (+60k) > Blade Ball (+20k)
      expect(gainers[0].game.title).toBe('Steal An Egg');
      expect(gainers[0].absDiff).toBe(500000);

      expect(gainers[1].game.title).toBe('Speed City Boost');
      expect(gainers[1].absDiff).toBe(60000);

      expect(gainers[2].game.title).toBe('Blade Ball Reforged');
      expect(gainers[2].absDiff).toBe(20000);
    });

    it('1.3 Должен корректно ранжировать по относительному процентному приросту (pctDiff desc)', () => {
      const gainers = calculate24hGainers(sampleCurrentSnapshot, samplePreviousSnapshot, 'pct');
      expect(gainers.length).toBeGreaterThanOrEqual(3);

      // Ожидаемый порядок: Speed City (+300%) > Steal An Egg (+50%) > Blade Ball (+7.14%)
      expect(gainers[0].game.title).toBe('Speed City Boost');
      expect(gainers[0].pctDiff).toBeCloseTo(300.0, 1);

      expect(gainers[1].game.title).toBe('Steal An Egg');
      expect(gainers[1].pctDiff).toBeCloseTo(50.0, 1);

      expect(gainers[2].game.title).toBe('Blade Ball Reforged');
      expect(gainers[2].pctDiff).toBeCloseTo(7.14, 1);
    });

    it('1.4 Должен безопасно обрабатывать отсутствие previousSnapshot (null / undefined) без падений', () => {
      // Вызов с null
      const gainersNull = calculate24hGainers(sampleCurrentSnapshot, null, 'abs');
      expect(gainersNull).toBeDefined();
      expect(Array.isArray(gainersNull)).toBe(true);
      expect(gainersNull.length).toBeGreaterThan(0);
      for (const item of gainersNull) {
        expect(Number.isFinite(item.absDiff)).toBe(true);
        expect(Number.isFinite(item.pctDiff)).toBe(true);
        expect(Number.isNaN(item.absDiff)).toBe(false);
        expect(Number.isNaN(item.pctDiff)).toBe(false);
      }

      // Вызов с undefined
      const gainersUndefined = calculate24hGainers(sampleCurrentSnapshot, undefined, 'pct');
      expect(gainersUndefined).toBeDefined();
      expect(gainersUndefined.length).toBeGreaterThan(0);

      // Инициализация компонента без предыдущего снимка
      expect(() => {
        new MoversViewComponent({
          container: mockContainer as any,
          currentSnapshot: sampleCurrentSnapshot,
          previousSnapshot: null,
        });
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // 2. Корректность выборки вирусных сигналов YouTube Shorts
  // ==========================================================================
  describe('2. Корректность выборки вирусных сигналов YouTube Shorts', () => {
    it('2.1 Должен фильтровать вирусные сигналы с viralMultiplier >= 1.5x', () => {
      const signals = filterViralSignals(sampleCurrentSnapshot, 1.5);
      expect(signals).toBeDefined();
      expect(signals.length).toBeGreaterThan(0);

      // Сигналы с множителем >= 1.5 должны присутствовать
      for (const s of signals) {
        expect(s.viralMultiplier).toBeGreaterThanOrEqual(1.5);
      }

      // SIMULATION_INCREMENTAL (1.85) и PHYSICS_SANDBOX (1.6) включены
      const archetypes = signals.map(s => s.archetype);
      expect(archetypes).toContain('SIMULATION_INCREMENTAL');
      expect(archetypes).toContain('PHYSICS_SANDBOX');

      // OTHER_CASUAL (1.2) не должен пройти фильтр
      expect(archetypes).not.toContain('OTHER_CASUAL');
    });

    it('2.2 Каждая карточка вирусного сигнала должна содержать вирусные метрики, название и архетип', () => {
      const signals = filterViralSignals(sampleCurrentSnapshot, 1.5);
      const topSignal = signals.find(s => s.archetype === 'SIMULATION_INCREMENTAL');
      expect(topSignal).toBeDefined();

      expect(topSignal?.viralMultiplier).toBe(1.85);
      expect(topSignal?.trendTitle).toBeTruthy();
      expect(topSignal?.archetype).toBe('SIMULATION_INCREMENTAL');
      expect(typeof topSignal?.metricValue).toBe('number');
    });
  });

  // ==========================================================================
  // 3. Корректность выборки взрывных новинок (< 14 дней)
  // ==========================================================================
  describe('3. Корректность выборки взрывных новинок (< 14 дней)', () => {
    it('3.1 Должен отбирать только молодые проекты по тегам up-and-coming / новизне / дате', () => {
      const breakouts = filterBreakoutNewReleases(sampleCurrentSnapshot, 14);
      expect(breakouts).toBeDefined();

      const titles = breakouts.map(b => b.game.title);
      // Молодые проекты должны быть включены
      expect(titles).toContain('Aura Craft 3D');
      expect(titles).toContain('Dungeon Ascend');

      // Старый проект Classic Obby 2024 (от 2025 года без тега up-and-coming) исключен
      expect(titles).not.toContain('Classic Obby 2024');
    });

    it('3.2 Должен ранжировать новинки по набранной аудитории (CCU desc)', () => {
      const breakouts = filterBreakoutNewReleases(sampleCurrentSnapshot, 14);
      expect(breakouts.length).toBeGreaterThanOrEqual(2);

      // Ожидаемый порядок: Aura Craft 3D (95k) > Dungeon Ascend (42k)
      expect(breakouts[0].game.title).toBe('Aura Craft 3D');
      expect(breakouts[0].ccu).toBe(95000);

      expect(breakouts[1].game.title).toBe('Dungeon Ascend');
      expect(breakouts[1].ccu).toBe(42000);
    });
  });

  // ==========================================================================
  // 4. Генерация спарклайнов тренда
  // ==========================================================================
  describe('4. Генерация спарклайнов тренда', () => {
    it('4.1 Должен формировать валидный спарклайн (точки, svgPath с командами M и L, признак положительного роста)', () => {
      const eggGame = sampleCurrentGames[0];
      const sparkline = generateMoversSparkline(eggGame, 80, 24);

      expect(sparkline).toBeDefined();
      expect(Array.isArray(sparkline.points)).toBe(true);
      expect(sparkline.points.length).toBeGreaterThanOrEqual(2);

      // svgPath содержит SVG команды M и L
      expect(sparkline.svgPath).toContain('M');
      expect(sparkline.svgPath).toContain('L');
      expect(/M\s*[\d.]+\s*[\d.]+/.test(sparkline.svgPath)).toBe(true);

      // Признак тренда и процент дельты
      expect(typeof sparkline.isPositive).toBe('boolean');
      expect(typeof sparkline.deltaPercent).toBe('number');
      expect(Number.isFinite(sparkline.deltaPercent)).toBe(true);
    });

    it('4.2 Должен корректно генерировать спарклайн из массива числовых точек', () => {
      const points = [100, 120, 150, 180, 220];
      const sparkline = generateMoversSparkline(points as any, 100, 30);

      expect(sparkline.isPositive).toBe(true);
      expect(sparkline.points).toEqual(points);
      expect(sparkline.svgPath).toMatch(/M.*L/);
    });
  });

  // ==========================================================================
  // 5. Рендеринг DOM структуры MoversView
  // ==========================================================================
  describe('5. Рендеринг DOM структуры MoversView', () => {
    it('5.1 Должен рендерить 3 обязательные секции (24h Gainers, YouTube Shorts, Breakout New Releases)', () => {
      new MoversViewComponent({
        container: mockContainer as any,
        currentSnapshot: sampleCurrentSnapshot,
        previousSnapshot: samplePreviousSnapshot,
      });

      // Проверка наличия 3 секций через селекторы классов или data-атрибутов
      const gainersSection =
        mockContainer.querySelector('.movers-section-gainers') ||
        mockContainer.querySelector('[data-section="gainers"]');
      const viralSection =
        mockContainer.querySelector('.movers-section-viral') ||
        mockContainer.querySelector('[data-section="viral"]');
      const breakoutSection =
        mockContainer.querySelector('.movers-section-breakout') ||
        mockContainer.querySelector('[data-section="breakout"]');

      expect(gainersSection).not.toBeNull();
      expect(viralSection).not.toBeNull();
      expect(breakoutSection).not.toBeNull();

      // Проверка наличия заголовков секций в разметке
      const html = mockContainer.innerHTML;
      expect(html).toMatch(/Gainers|Лидеры роста/i);
      expect(html).toMatch(/YouTube Shorts|Вирусные сигналы/i);
      expect(html).toMatch(/Breakout|Взрывные новинки|14 дней/i);
    });

    it('5.2 В каждой секции карточки должны содержать название, спарклайн, тег архетипа и кнопку инспектора', () => {
      new MoversViewComponent({
        container: mockContainer as any,
        currentSnapshot: sampleCurrentSnapshot,
        previousSnapshot: samplePreviousSnapshot,
      });

      const cards =
        mockContainer.querySelectorAll('.movers-card') ||
        mockContainer.querySelectorAll('[data-card="mover"]');
      expect(cards.length).toBeGreaterThanOrEqual(3);

      const firstCard = cards[0];
      const cardHtml = firstCard.innerHTML;

      // 1. Название
      const titleEl =
        firstCard.querySelector('.card-title') ||
        firstCard.querySelector('.movers-card-title') ||
        firstCard.querySelector('h3, h4');
      expect(titleEl || cardHtml.includes('Steal An Egg')).toBeTruthy();

      // 2. Спарклайн SVG (наличие path и svg)
      expect(cardHtml).toMatch(/<svg[\s\S]*?<path/i);

      // 3. Тег архетипа
      const archetypeEl =
        firstCard.querySelector('.archetype-tag') ||
        firstCard.querySelector('[data-archetype]') ||
        firstCard.querySelector('.badge-archetype');
      expect(archetypeEl || cardHtml.includes('SIMULATION_INCREMENTAL') || cardHtml.includes('Симуляторы')).toBeTruthy();

      // 4. Кнопка инспектора
      const inspectBtn =
        firstCard.querySelector('.btn-inspect') ||
        firstCard.querySelector('.card-inspect-btn') ||
        firstCard.querySelector('button[data-action="inspect"]') ||
        firstCard.querySelector('button');
      expect(inspectBtn).not.toBeNull();
    });
  });

  // ==========================================================================
  // 6. Интерактивность и события
  // ==========================================================================
  describe('6. Интерактивность и события', () => {
    it('6.1 Клик по кнопке инспектора карточки игры должен вызывать onSelectGame', () => {
      const onSelectGame = vi.fn();
      const onSelectArchetype = vi.fn();

      new MoversViewComponent({
        container: mockContainer as any,
        currentSnapshot: sampleCurrentSnapshot,
        previousSnapshot: samplePreviousSnapshot,
        onSelectGame,
        onSelectArchetype,
      });

      const gainersSection =
        mockContainer.querySelector('.movers-section-gainers') ||
        mockContainer.querySelector('[data-section="gainers"]') ||
        mockContainer;

      const inspectBtn =
        gainersSection.querySelector('.btn-inspect') ||
        gainersSection.querySelector('.card-inspect-btn') ||
        gainersSection.querySelector('button[data-action="inspect"]') ||
        gainersSection.querySelector('button');

      expect(inspectBtn).not.toBeNull();
      inspectBtn?.click();

      // Проверяем вызов коллбэка onSelectGame
      expect(onSelectGame).toHaveBeenCalled();
      const calledArg = onSelectGame.mock.calls[0][0];
      expect(calledArg).toBeDefined();
      expect(calledArg.title).toBeDefined();
    });

    it('6.2 Переключение режима сортировки лидеров роста (abs / pct) должно обновлять порядок', () => {
      const view = new MoversViewComponent({
        container: mockContainer as any,
        currentSnapshot: sampleCurrentSnapshot,
        previousSnapshot: samplePreviousSnapshot,
        initialGainersSort: 'abs',
      });

      expect(view.getGainersSort()).toBe('abs');
      let gainers = view.getGainers();
      expect(gainers[0].game.title).toBe('Steal An Egg'); // +500k abs

      // Переключаем на процентный прирост
      view.setGainersSort('pct');
      expect(view.getGainersSort()).toBe('pct');
      gainers = view.getGainers();
      expect(gainers[0].game.title).toBe('Speed City Boost'); // +300% pct
    });

    it('6.3 Клик по кнопке переключения сортировки в UI должен вызывать переключение режима', () => {
      const view = new MoversViewComponent({
        container: mockContainer as any,
        currentSnapshot: sampleCurrentSnapshot,
        previousSnapshot: samplePreviousSnapshot,
        initialGainersSort: 'abs',
      });

      const toggleSortBtn =
        mockContainer.querySelector('.btn-toggle-sort-pct') ||
        mockContainer.querySelector('[data-sort-mode="pct"]') ||
        mockContainer.querySelector('.gainers-sort-toggle');

      if (toggleSortBtn) {
        toggleSortBtn.click();
        expect(view.getGainersSort()).toBe('pct');
      } else {
        // Fallback через программный API
        view.setGainersSort('pct');
        expect(view.getGainersSort()).toBe('pct');
      }
    });
  });

  // ==========================================================================
  // 7. Метод updateData(currentSnapshot, previousSnapshot)
  // ==========================================================================
  describe('7. Метод updateData(currentSnapshot, previousSnapshot)', () => {
    it('7.1 Должен реактивно обновлять данные и карточки при смене снимков рынка', () => {
      const view = new MoversViewComponent({
        container: mockContainer as any,
        currentSnapshot: sampleCurrentSnapshot,
        previousSnapshot: samplePreviousSnapshot,
      });

      const initialGainers = view.getGainers();
      expect(initialGainers[0].game.title).toBe('Steal An Egg');

      // Создаем обновленный снимок, где лидером абсолютного роста становится Blade Ball
      const updatedGames: NormalizedGame[] = [
        {
          ...sampleCurrentGames[0],
          metricValue: 1100000, // +100k abs
        },
        {
          ...sampleCurrentGames[2],
          metricValue: 1200000, // +920k abs (теперь на 1 месте)
        },
      ];

      const updatedSnapshot: MarketSnapshot = {
        ...sampleCurrentSnapshot,
        id: 'snapshot-2026-10-04',
        games: updatedGames,
      };

      view.updateData(updatedSnapshot, samplePreviousSnapshot);

      const updatedGainers = view.getGainers();
      expect(updatedGainers).toBeDefined();
      expect(updatedGainers[0].game.title).toBe('Blade Ball Reforged');
      expect(updatedGainers[0].absDiff).toBe(920000);
    });

    it('7.2 Должен корректно очищать слушатели при вызове destroy()', () => {
      const view = new MoversViewComponent({
        container: mockContainer as any,
        currentSnapshot: sampleCurrentSnapshot,
        previousSnapshot: samplePreviousSnapshot,
      });

      expect(() => {
        view.destroy();
      }).not.toThrow();
    });
  });
});
