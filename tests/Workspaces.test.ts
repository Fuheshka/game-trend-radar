import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CatalogWorkspace } from '../web/src/app/workspaces/catalogWorkspace.js';
import { ArbitrageWorkspace } from '../web/src/app/workspaces/arbitrageWorkspace.js';
import { MoversWorkspace } from '../web/src/app/workspaces/moversWorkspace.js';
import { createAppState } from '../web/src/app/state.js';
import { FALLBACK_SNAPSHOT } from '../web/src/fallbackData.js';
import { MarketSnapshot, NormalizedGame } from '../web/src/types.js';

function games(prefix: string, count: number): NormalizedGame[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}_${i}`,
    platform: 'roblox',
    title: `${prefix} game ${i}`,
    genre: 'Action',
    archetype: 'ACTION_SHOOTER',
    metricValue: (i + 1) * 1000,
    metricType: 'ccu',
    likeRatio: 0.85,
    tags: [],
    timestamp: '2026-10-18T03:00:00Z',
  }));
}

function snap(id: string, list: NormalizedGame[]): MarketSnapshot {
  return { ...(FALLBACK_SNAPSHOT as MarketSnapshot), id, games: list, totalGamesScanned: list.length };
}

// Минимальный document: контейнер каталога как в GameTableView.test.ts и текстовые бейджи
let listeners: Record<string, (e: any) => void>;
let catalogContainer: any;
let elements: Record<string, any>;

beforeEach(() => {
  listeners = {};
  catalogContainer = {
    innerHTML: '',
    addEventListener: vi.fn((event: string, handler: (e: any) => void) => {
      listeners[event] = handler;
    }),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
  };
  elements = {
    'catalog-container': catalogContainer,
    'tab-games-count': { textContent: '' },
    'catalog-count-text': { textContent: '' },
    'tab-arbitrage-count': { textContent: '' },
  };
  vi.stubGlobal('document', { getElementById: (id: string) => elements[id] ?? null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const rows = () => (catalogContainer.innerHTML.match(/<tr class="steamdb-table-row/g) || []).length;

describe('контроллеры вкладок: ленивое монтирование и смена снимка', () => {
  it('каталог: до открытия вкладки update() не монтирует таблицу, бейдж считается по снимку', () => {
    const state = createAppState();
    state.snapshot = snap('a', games('a', 60));
    const catalog = new CatalogWorkspace({ state, drawer: { openGameFromList: vi.fn() } });

    catalog.update();
    expect(catalogContainer.innerHTML).toBe('');
    expect(elements['tab-games-count'].textContent).toBe('60');
    expect(elements['catalog-count-text'].textContent).toBe('Отображается 60 из 60');

    catalog.show();
    catalog.show();
    expect(rows()).toBe(50);
    expect(catalogContainer.addEventListener).toHaveBeenCalledTimes(1); // смонтирован один раз
  });

  it('каталог: «Показать ещё» сбрасывается на первую страницу при смене снимка', () => {
    const state = createAppState();
    state.snapshot = snap('a', games('a', 60));
    const catalog = new CatalogWorkspace({ state, drawer: { openGameFromList: vi.fn() } });
    catalog.show();

    const loadMore = { closest: (sel: string) => (sel === '#btn-table-load-more' ? loadMore : null) };
    listeners['click']({ target: loadMore, stopPropagation: vi.fn() });
    expect(rows()).toBe(60);

    state.snapshot = snap('b', games('b', 70));
    catalog.update();
    expect(rows()).toBe(50);
    expect(catalogContainer.innerHTML).toContain('b game');
    expect(elements['catalog-count-text'].textContent).toBe('Отображается 70 из 70');
  });

  it('арбитраж: бейдж по снимку без монтирования матрицы', () => {
    const state = createAppState();
    const arbitrage = new ArbitrageWorkspace({ state, drawer: { openGameFromList: vi.fn() } });
    arbitrage.update();
    expect(elements['tab-arbitrage-count'].textContent).toBe(String(FALLBACK_SNAPSHOT.arbitrageOpportunities!.length));
  });

  it('лидеры роста: без контейнера и до открытия вкладки update() — no-op', () => {
    const state = createAppState();
    const movers = new MoversWorkspace({ state, drawer: { openGameFromList: vi.fn(), openArchetypeFromMovers: vi.fn() } });
    expect(() => movers.update()).not.toThrow();
    expect(() => movers.show()).not.toThrow(); // #view-movers нет в этом document
  });
});
