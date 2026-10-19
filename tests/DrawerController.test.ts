import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveGame, getGamesForArchetype } from '../web/src/app/gameLookup.js';
import { DrawerController } from '../web/src/app/drawerController.js';
import { createAppState } from '../web/src/app/state.js';
import { FALLBACK_SNAPSHOT } from '../web/src/fallbackData.js';
import { MarketSnapshot, NormalizedGame } from '../web/src/types.js';

const snapshot = FALLBACK_SNAPSHOT as MarketSnapshot;

function game(over: Partial<NormalizedGame>): NormalizedGame {
  return {
    id: 'g1',
    platform: 'roblox',
    title: 'Game',
    genre: 'x',
    archetype: 'OBBY_PARKOUR',
    metricValue: 1000,
    metricType: 'ccu',
    tags: [],
    timestamp: '2026-10-18T03:00:00Z',
    ...over,
  };
}

describe('gameLookup: игра для drawer', () => {
  it('точное совпадение по id и названию (без регистра), затем подстрока', () => {
    expect(resolveGame(snapshot, 'roblox_10563114921').title).toBe('Steal An Egg');
    expect(resolveGame(snapshot, '  steal an egg ').id).toBe('roblox_10563114921');
    expect(resolveGame(snapshot, 'Blox').id).toBe('roblox_994732206');
  });

  it('аналог из арбитража превращается в карточку Яндекс Игр', () => {
    const snap: MarketSnapshot = {
      ...snapshot,
      games: [],
      arbitrageOpportunities: [
        {
          ...snapshot.arbitrageOpportunities![0],
          robloxGame: game({ title: 'Roblox Hit' }),
          robloxCCU: 100_000,
          nearestAnalog: { id: 'ya_1', title: 'Яндекс Аналог', archetype: 'MERGE_IDLE' } as never,
        },
      ],
    };
    const found = resolveGame(snap, 'яндекс');
    expect(found).toMatchObject({ id: 'ya_1', platform: 'yandex_games', archetype: 'MERGE_IDLE', metricValue: 15_000 });
  });

  it('неизвестная игра синтезируется из вердикта подсказанного архетипа', () => {
    const verdict = snapshot.verdicts.find(v => v.archetype === 'WORD_PUZZLE')!;
    const found = resolveGame(snapshot, 'Совсем новая игра', 'WORD_PUZZLE');
    expect(found.id).toBe(`synth_${encodeURIComponent('совсем новая игра')}`);
    expect(found.archetype).toBe('WORD_PUZZLE');
    expect(found.genre).toBe(verdict.titleRu);
    expect(found.url).toContain('Keyword=');
    expect(resolveGame(snapshot, 'zzz-нет-такой').archetype).toBe('OTHER_CASUAL');
  });

  it('игры архетипа дополняются примерами вердикта без дублей', () => {
    const snap: MarketSnapshot = {
      ...snapshot,
      games: [game({ title: 'Tower Run' })],
      verdicts: [{ ...snapshot.verdicts[0], archetype: 'OBBY_PARKOUR', sampleTitles: ['tower run', 'Mega Obby', ''] }],
    };
    const titles = getGamesForArchetype(snap, 'OBBY_PARKOUR').map(g => g.title);
    expect(titles).toEqual(['Tower Run', 'Mega Obby']);
  });
});

describe('DrawerController', () => {
  function setup() {
    const state = createAppState();
    const onFilterSearch = vi.fn();
    const view = { openGame: vi.fn(), openArchetype: vi.fn(), openSignal: vi.fn(), close: vi.fn() };
    const modal = { open: vi.fn() };
    const controller = new DrawerController({ state, onFilterSearch });
    controller.mountDrawer(view);
    controller.mountPromptModal(modal);
    return { controller, state, view, modal, onFilterSearch };
  }

  it('архетип открывается с играми снимка и примерами вердикта; неизвестный — игнорируется', () => {
    const t = setup();
    t.controller.openArchetypeDetail('SURVIVAL_HORROR');
    const [verdict, games] = t.view.openArchetype.mock.calls[0];
    expect(verdict.archetype).toBe('SURVIVAL_HORROR');
    expect(games).toEqual(getGamesForArchetype(snapshot, 'SURVIVAL_HORROR'));

    t.controller.openArchetypeDetail('NOT_AN_ARCHETYPE' as never);
    expect(t.view.openArchetype).toHaveBeenCalledTimes(1);
  });

  it('игра по названию открывается с родительским вердиктом; пустое название — ничего', () => {
    const t = setup();
    t.controller.openGameDetail('Steal An Egg');
    const [found, , parent] = t.view.openGame.mock.calls[0];
    expect(found.id).toBe('roblox_10563114921');
    expect(parent?.archetype).toBe('SIMULATION_INCREMENTAL');
    t.controller.openGameDetail('');
    expect(t.view.openGame).toHaveBeenCalledTimes(1);
  });

  it('сигнал тикера открывает drawer сигнала и фильтрует радар', () => {
    const t = setup();
    const signal = { searchFilter: 'обби', archetype: 'OBBY_PARKOUR' } as never;
    t.controller.handleTickerSignalClick(signal);
    expect(t.view.openSignal).toHaveBeenCalledWith(signal);
    expect(t.onFilterSearch).toHaveBeenCalledWith('обби', 'OBBY_PARKOUR');
  });

  it('генератор ТЗ получает вердикт, игры и арбитраж архетипа', () => {
    const t = setup();
    const opp = snapshot.arbitrageOpportunities![0];
    t.controller.openPromptModalForArchetype(opp.archetype);
    const [verdict, games, arbitrage] = t.modal.open.mock.calls[0];
    expect(verdict?.archetype).toBe(opp.archetype);
    expect(games.length).toBeGreaterThan(0);
    expect(arbitrage).toBe(opp);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('кнопка ТЗ открывает генератор для архетипа, который drawer показывает сейчас, а не открытого раньше', () => {
    const t = setup();
    let onClick: (e: unknown) => void = () => {};
    vi.stubGlobal('MutationObserver', class { observe() {} });
    // Разметка drawer'а: кнопка фильтра несёт архетип (её нет в drawer'е игры), кнопка ТЗ уже вставлена
    let shown: string | null = 'SURVIVAL_HORROR';
    const drawerEl = {
      addEventListener: (_: string, cb: (e: unknown) => void) => (onClick = cb),
      querySelector: (sel: string) => {
        if (sel === '#drawer-btn-filter-archetype') return shown ? { getAttribute: () => shown } : null;
        if (sel === '.drawer-footer-actions') return { querySelector: () => ({}) };
        return null;
      },
    };
    const clickSpec = () => onClick({ target: { closest: () => ({}) }, stopPropagation: () => {} });
    t.controller.bindDrawerEvents(drawerEl as never);

    t.controller.openArchetypeDetail('SURVIVAL_HORROR');
    clickSpec();
    expect(t.modal.open.mock.calls[0][0]?.archetype).toBe('SURVIVAL_HORROR');

    // Архетип открыт в обход openArchetypeDetail — с вкладки «Лидеры» (или «← к архетипу» в drawer'е)
    t.controller.openArchetypeFromMovers('OBBY_PARKOUR');
    shown = 'OBBY_PARKOUR';
    clickSpec();
    expect(t.modal.open.mock.calls[1][0]?.archetype).toBe('OBBY_PARKOUR');

    shown = null; // drawer игры
    clickSpec();
    expect(t.modal.open).toHaveBeenCalledTimes(2);
  });
});
