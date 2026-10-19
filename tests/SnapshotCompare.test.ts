import { describe, it, expect, vi } from 'vitest';
import {
  readCompareParam,
  resolveBaseSnapshotId,
  withCompareParam,
} from '../web/src/app/compare.js';
import { computeArchetypeDelta, diffArbitrageNiches } from '../web/src/utils/snapshotDiff.js';
import { SnapshotController, SnapshotApi } from '../web/src/app/snapshotController.js';
import { createAppState } from '../web/src/app/state.js';
import { MetricsTracker } from '../web/src/app/metricsController.js';
import { MoversViewComponent } from '../web/src/components/MoversView.js';
import { FALLBACK_SNAPSHOT } from '../web/src/fallbackData.js';
import {
  ArbitrageOpportunity,
  GameArchetype,
  MarketSnapshot,
  MarketVerdict,
  NormalizedGame,
  SnapshotSummary,
} from '../web/src/types.js';

function summary(id: string, date: string): SnapshotSummary {
  return { id, timestamp: `${date}T03:00:00Z`, date, totalGamesScanned: 500, filename: `${id}.json` };
}

function verdict(archetype: GameArchetype, titleRu: string, score: number, ccu: number): MarketVerdict {
  const base = FALLBACK_SNAPSHOT.verdicts[0];
  return {
    ...base,
    archetype,
    titleRu,
    totalAudienceCCU: ccu,
    opportunityScore: { ...base.opportunityScore, overallScore: score },
  };
}

function game(id: string, ccu: number): NormalizedGame {
  return { ...FALLBACK_SNAPSHOT.games[0], id, title: id, platform: 'roblox', metricType: 'ccu', metricValue: ccu };
}

function niche(id: string): ArbitrageOpportunity {
  return { robloxGame: game(id, 200_000), robloxCCU: 200_000, archetype: 'OBBY_PARKOUR' } as ArbitrageOpportunity;
}

function snap(id: string, date: string, extra: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return { ...(FALLBACK_SNAPSHOT as MarketSnapshot), id, timestamp: `${date}T03:00:00Z`, ...extra };
}

const LIST = [
  summary('snapshot-2026-10-18', '2026-10-18'),
  summary('snapshot-2026-10-17', '2026-10-17'),
  summary('snapshot-2026-10-15', '2026-10-15'),
];

describe('выбор базы сравнения', () => {
  it('?compare= читается и переписывается, не трогая другие параметры и hash', () => {
    expect(readCompareParam('?compare=snapshot-2026-10-15')).toBe('snapshot-2026-10-15');
    expect(readCompareParam('?compare=')).toBeNull();
    expect(readCompareParam('')).toBeNull();
    expect(withCompareParam('https://x.dev/?tab=2#a', 'snapshot-2026-10-15')).toBe(
      'https://x.dev/?tab=2&compare=snapshot-2026-10-15#a'
    );
    expect(withCompareParam('https://x.dev/?compare=snapshot-2026-10-15&tab=2', null)).toBe('https://x.dev/?tab=2');
  });

  it('явная база из истории; без выбора, с неизвестной или совпадающей с текущим — предыдущий срез', () => {
    const [d18, d17, d15] = LIST.map(s => s.id);
    expect(resolveBaseSnapshotId(LIST, d18, d15)).toBe(d15);
    // База новее текущего тоже допустима — дельты просто с обратным знаком
    expect(resolveBaseSnapshotId(LIST, d15, d18)).toBe(d18);
    expect(resolveBaseSnapshotId(LIST, d18, null)).toBe(d17);
    expect(resolveBaseSnapshotId(LIST, d18, 'snapshot-2020-01-01')).toBe(d17);
    expect(resolveBaseSnapshotId(LIST, d17, d17)).toBe(d15);
    expect(resolveBaseSnapshotId(LIST, d15, null)).toBeNull();
    expect(resolveBaseSnapshotId([], 'x', null)).toBeNull();
  });
});

describe('дельты двух срезов', () => {
  it('архетипы «было → стало»: score и CCU, новые и исчезнувшие, рост сверху', () => {
    const base = snap('b', '2026-10-15', {
      verdicts: [verdict('OBBY_PARKOUR', 'Обби', 60, 100_000), verdict('MERGE_IDLE', 'Тайкун', 70, 50_000), verdict('SURVIVAL_HORROR', 'Хоррор', 40, 10_000)],
    });
    const current = snap('c', '2026-10-18', {
      verdicts: [verdict('OBBY_PARKOUR', 'Обби', 75, 150_000), verdict('MERGE_IDLE', 'Тайкун', 65, 40_000), verdict('SIMULATION_INCREMENTAL', 'Симулятор', 50, 30_000)],
    });
    const rows = computeArchetypeDelta(current, base);
    expect(rows.map(r => r.archetype)).toEqual(['SIMULATION_INCREMENTAL', 'OBBY_PARKOUR', 'MERGE_IDLE', 'SURVIVAL_HORROR']);
    expect(rows.find(r => r.archetype === 'OBBY_PARKOUR')).toMatchObject({
      scoreBefore: 60,
      scoreAfter: 75,
      ccuBefore: 100_000,
      ccuAfter: 150_000,
    });
    expect(rows.find(r => r.archetype === 'SIMULATION_INCREMENTAL')).toMatchObject({ scoreBefore: null, scoreAfter: 50 });
    expect(rows.find(r => r.archetype === 'SURVIVAL_HORROR')).toMatchObject({ scoreBefore: 40, scoreAfter: null, ccuAfter: null });
  });

  it('арбитраж: новые и исчезнувшие ниши по игре Roblox', () => {
    const base = snap('b', '2026-10-15', { arbitrageOpportunities: [niche('a'), niche('b')] });
    const current = snap('c', '2026-10-18', { arbitrageOpportunities: [niche('b'), niche('c'), niche('d')] });
    const { added, removed } = diffArbitrageNiches(current, base);
    expect(added.map(o => o.robloxGame.id)).toEqual(['c', 'd']);
    expect(removed.map(o => o.robloxGame.id)).toEqual(['a']);
    expect(diffArbitrageNiches(snap('x', '2026-10-18', { arbitrageOpportunities: undefined }), base).removed).toHaveLength(2);
  });

  it('KPI: % CCU считается от выбранной базы', () => {
    const current = snap('c', '2026-10-18', { robloxTotalCCU: 1_200_000 });
    expect(new MetricsTracker().next(current, snap('p', '2026-10-17', { robloxTotalCCU: 1_000_000 })).metrics.ccuChangePercent).toBe(20);
    expect(new MetricsTracker().next(current, snap('o', '2026-10-15', { robloxTotalCCU: 1_500_000 })).metrics.ccuChangePercent).toBe(-20);
  });
});

describe('SnapshotController: база из «Сравнить с»', () => {
  const byId: Record<string, MarketSnapshot> = {
    'snapshot-2026-10-18': snap('snapshot-2026-10-18', '2026-10-18'),
    'snapshot-2026-10-17': snap('snapshot-2026-10-17', '2026-10-17'),
    'snapshot-2026-10-15': snap('snapshot-2026-10-15', '2026-10-15'),
  };

  function setup(urlCompare: string | null, api: Partial<SnapshotApi> = {}) {
    const state = createAppState();
    const header = { setScanAvailable: vi.fn(), setSnapshots: vi.fn(), setSseStatus: vi.fn(), setCompareOptions: vi.fn() };
    const compareUrl = { read: vi.fn(() => urlCompare), write: vi.fn() };
    const onApply = vi.fn();
    const controller = new SnapshotController({
      state,
      header,
      connectLive: vi.fn(),
      onApply,
      setServerStatus: vi.fn(),
      animateTransition: vi.fn(),
      getSelect: () => ({ value: '', options: { length: 1 } }),
      compareUrl,
      api: {
        fetchSnapshotList: async () => LIST,
        fetchSnapshotById: async id => byId[id],
        fetchLatestSnapshot: async () => null,
        fetchStaticSnapshot: async () => null,
        ...api,
      },
    });
    return { controller, state, header, compareUrl, onApply };
  }

  it('без ?compare= — предыдущий срез; селектор виден, без текущего среза в опциях', async () => {
    const t = setup(null);
    await t.controller.fetchSnapshots();
    expect(t.state.baseSnapshot?.id).toBe('snapshot-2026-10-17');
    expect(t.state.compareId).toBeNull();
    const [options, selected, visible] = t.header.setCompareOptions.mock.calls.at(-1)!;
    expect(options.map((o: { id: string }) => o.id)).toEqual(['snapshot-2026-10-17', 'snapshot-2026-10-15']);
    expect(selected).toBeNull();
    expect(visible).toBe(true);
  });

  it('?compare= из ссылки задаёт базу при старте', async () => {
    const t = setup('snapshot-2026-10-15');
    await t.controller.fetchSnapshots();
    expect(t.state.compareId).toBe('snapshot-2026-10-15');
    expect(t.state.baseSnapshot?.id).toBe('snapshot-2026-10-15');
    expect(t.header.setCompareOptions.mock.calls.at(-1)![1]).toBe('snapshot-2026-10-15');
    expect(t.compareUrl.write).not.toHaveBeenCalled();
  });

  it('неизвестный срез в ссылке — предыдущий, параметр убирается из URL', async () => {
    const t = setup('snapshot-2020-01-01');
    await t.controller.fetchSnapshots();
    expect(t.state.compareId).toBeNull();
    expect(t.state.baseSnapshot?.id).toBe('snapshot-2026-10-17');
    expect(t.compareUrl.write).toHaveBeenCalledWith(null);
  });

  it('смена базы пишет URL, загружает базу и перерисовывает экран; «Предыдущий» убирает параметр', async () => {
    const t = setup(null);
    await t.controller.fetchSnapshots();
    t.onApply.mockClear();

    await t.controller.selectCompare('snapshot-2026-10-15');
    expect(t.compareUrl.write).toHaveBeenLastCalledWith('snapshot-2026-10-15');
    expect(t.state.baseSnapshot?.id).toBe('snapshot-2026-10-15');
    expect(t.onApply).toHaveBeenCalledTimes(1);

    await t.controller.selectCompare(null);
    expect(t.compareUrl.write).toHaveBeenLastCalledWith(null);
    expect(t.state.baseSnapshot?.id).toBe('snapshot-2026-10-17');
  });

  it('текущим срезом выбрали саму базу — сравнение возвращается к предыдущему', async () => {
    const t = setup('snapshot-2026-10-17');
    await t.controller.fetchSnapshots();
    await t.controller.selectSnapshot('snapshot-2026-10-17', true);
    expect(t.state.compareId).toBeNull();
    expect(t.state.baseSnapshot?.id).toBe('snapshot-2026-10-15');
    expect(t.compareUrl.write).toHaveBeenLastCalledWith(null);
  });

  it('сбой загрузки базы не мешает показать текущий срез', async () => {
    const t = setup('snapshot-2026-10-15', {
      fetchSnapshotById: async id => {
        if (id === 'snapshot-2026-10-15') throw new Error('network');
        return byId[id];
      },
    });
    await t.controller.fetchSnapshots();
    expect(t.state.snapshot.id).toBe('snapshot-2026-10-18');
    expect(t.state.baseSnapshot).toBeNull();
    expect(t.onApply).toHaveBeenCalledTimes(1);
  });

  it('один срез в истории — сравнивать не с чем, селектор скрыт', async () => {
    const t = setup(null, { fetchSnapshotList: async () => LIST.slice(0, 1) });
    await t.controller.fetchSnapshots();
    expect(t.state.baseSnapshot).toBeNull();
    expect(t.header.setCompareOptions).toHaveBeenLastCalledWith([], null, false);
  });

  it('без API (статика) селектор сравнения не показывается', async () => {
    const t = setup(null, {
      fetchSnapshotList: async () => null,
      fetchStaticSnapshot: async () => snap('static', '2026-10-18'),
    });
    await t.controller.fetchSnapshots();
    expect(t.header.setCompareOptions).not.toHaveBeenCalled();
    expect(t.state.baseSnapshot).toBeNull();
  });
});

describe('MoversView: лидеры роста и архетипы от выбранной базы', () => {
  const container = () =>
    ({ innerHTML: '', addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as HTMLElement;

  const current = snap('c', '2026-10-18', {
    games: [game('alpha', 5_000), game('beta', 9_000)],
    // Окно 7 дней из снимка: без явной базы лидеры берутся отсюда
    risers: [
      { id: 'alpha', platform: 'roblox', title: 'alpha', metricType: 'ccu', signal: 'ccu', from: 1_000, to: 5_000 },
    ] as MarketSnapshot['risers'],
    verdicts: [verdict('OBBY_PARKOUR', 'Обби', 75, 150_000)],
  });
  const base = snap('b', '2026-10-15', {
    games: [game('alpha', 4_000), game('beta', 3_000)],
    verdicts: [verdict('OBBY_PARKOUR', 'Обби', 60, 100_000)],
  });

  it('по умолчанию — окно 7 дней; явная база — дельта от неё, заголовок «vs дата»', () => {
    const el = container();
    const view = new MoversViewComponent({ container: el, currentSnapshot: current, previousSnapshot: base });
    expect(view.getGainers().map(g => g.game.id)).toEqual(['alpha']);
    expect(el.innerHTML).toContain('Топ лидеров роста CCU (7 дней)');

    view.updateData(current, base, true);
    expect(view.getGainers().map(g => [g.game.id, g.absDiff])).toEqual([
      ['beta', 6_000],
      ['alpha', 1_000],
    ]);
    expect(el.innerHTML).toContain('Топ лидеров роста CCU (vs 15 окт)');
  });

  it('блок «Архетипы: было → стало» есть только при базе', () => {
    const el = container();
    const view = new MoversViewComponent({ container: el, currentSnapshot: current, previousSnapshot: base });
    expect(el.innerHTML).toContain('Архетипы: было → стало');
    expect(el.innerHTML).toContain('15 окт → 18 окт');
    expect(el.innerHTML).toMatch(/60 → 75/);
    expect(el.innerHTML).toMatch(/\+15/);
    expect(el.innerHTML).toMatch(/100k → 150k/);

    view.updateData(current, null);
    expect(el.innerHTML).not.toContain('Архетипы: было → стало');
  });
});
