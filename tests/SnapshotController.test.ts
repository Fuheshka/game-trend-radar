import { describe, it, expect, vi } from 'vitest';
import { SnapshotController, SnapshotApi, SnapshotSelect } from '../web/src/app/snapshotController.js';
import { createAppState } from '../web/src/app/state.js';
import { FALLBACK_SNAPSHOT } from '../web/src/fallbackData.js';
import { MarketSnapshot, SnapshotSummary } from '../web/src/types.js';

function snap(id: string, timestamp = '2026-10-18T03:00:00Z', totalGamesScanned = 537): MarketSnapshot {
  return { ...(FALLBACK_SNAPSHOT as MarketSnapshot), id, timestamp, totalGamesScanned };
}

function summary(id: string, date: string): SnapshotSummary {
  return { id, timestamp: `${date}T03:00:00Z`, date, totalGamesScanned: 500, filename: `${id}.json` };
}

/** Контроллер с подменёнными сетью, шапкой и селектором; DOM не нужен. */
function setup(api: Partial<SnapshotApi>, selectOptions = 1) {
  const state = createAppState();
  const header = { setScanAvailable: vi.fn(), setSnapshots: vi.fn(), setSseStatus: vi.fn(), setCompareOptions: vi.fn() };
  const select: SnapshotSelect = { value: '', options: { length: selectOptions } };
  const deps = {
    connectLive: vi.fn(),
    onApply: vi.fn(),
    setServerStatus: vi.fn(),
    animateTransition: vi.fn(),
  };
  const controller = new SnapshotController({
    state,
    header,
    ...deps,
    getSelect: () => select,
    api: {
      fetchSnapshotList: async () => null,
      fetchSnapshotById: async () => undefined,
      fetchLatestSnapshot: async () => null,
      fetchStaticSnapshot: async () => null,
      ...api,
    },
  });
  return { controller, state, header, select, ...deps };
}

describe('SnapshotController: выбор режима данных', () => {
  it('нет API, есть статический снимок (GitHub Pages): скан скрыт, SSE не подключается, одна опция среза', async () => {
    const t = setup({ fetchStaticSnapshot: async () => snap('static-1') });
    await t.controller.fetchSnapshots();

    expect(t.header.setScanAvailable).toHaveBeenCalledWith(false);
    expect(t.connectLive).not.toHaveBeenCalled();
    expect(t.state.snapshot.id).toBe('static-1');
    expect(t.setServerStatus).toHaveBeenLastCalledWith(true, 'GitHub Pages (Статика)');
    expect(t.header.setSseStatus).toHaveBeenLastCalledWith(true, 'Статика');
    expect(t.header.setSnapshots).toHaveBeenCalledWith([{ id: 'static-1', label: '18 окт (537 игр)' }], 'static-1');
    expect(t.onApply).toHaveBeenCalledTimes(1);
  });

  it('ни API, ни статики: демо-данные с опцией «Демо-данные»', async () => {
    const t = setup({});
    await t.controller.fetchSnapshots();

    expect(t.header.setScanAvailable).toHaveBeenCalledWith(false);
    expect(t.connectLive).not.toHaveBeenCalled();
    expect(t.state.snapshot).toBe(FALLBACK_SNAPSHOT);
    expect(t.setServerStatus).toHaveBeenLastCalledWith(false, 'Демонстрационный режим');
    expect(t.header.setSseStatus).toHaveBeenLastCalledWith(false, 'Оффлайн');
    expect(t.header.setSnapshots).toHaveBeenCalledWith([{ id: FALLBACK_SNAPSHOT.id, label: 'Демо-данные' }], FALLBACK_SNAPSHOT.id);
    expect(t.onApply).toHaveBeenCalledTimes(1);
  });

  it('сервер жив, но срезов нет ([]) — это не «нет API»: скан доступен, SSE подключается, берётся /latest', async () => {
    const latest = snap('latest-1');
    const t = setup({ fetchSnapshotList: async () => [], fetchLatestSnapshot: async () => latest });
    await t.controller.fetchSnapshots();

    expect(t.header.setScanAvailable).toHaveBeenCalledWith(true);
    expect(t.connectLive).toHaveBeenCalledTimes(1);
    expect(t.state.snapshot).toBe(latest);
    expect(t.state.currentSnapshotId).toBe('latest-1');
    expect(t.state.snapshotsCache.get('latest-1')).toBe(latest);
    expect(t.header.setSnapshots).toHaveBeenCalledWith([{ id: 'latest-1', label: '18 окт (537 игр)' }], 'latest-1');
  });

  it('/latest не трогает селектор, если в нём уже есть срезы', async () => {
    const t = setup({ fetchLatestSnapshot: async () => snap('latest-1') }, 3);
    await t.controller.fetchLatestSnapshot();
    expect(t.header.setSnapshots).not.toHaveBeenCalled();
  });

  it('список срезов с API: заполняет селектор, выбирает первый срез, предыдущий в истории — базой для дельт', async () => {
    const list = [summary('s2', '2026-10-18'), summary('s1', '2026-10-17')];
    const byId: Record<string, MarketSnapshot> = { s2: snap('s2'), s1: snap('s1', '2026-10-17T03:00:00Z') };
    const t = setup({
      fetchSnapshotList: async () => list,
      fetchSnapshotById: async (id, cache) => {
        cache.set(id, byId[id]);
        return byId[id];
      },
    });
    await t.controller.fetchSnapshots();

    expect(t.header.setScanAvailable).toHaveBeenCalledWith(true);
    expect(t.connectLive).toHaveBeenCalledTimes(1);
    expect(t.header.setSnapshots.mock.calls[0][0].map((o: { id: string }) => o.id)).toEqual(['s2', 's1']);
    expect(t.select.value).toBe('s2');
    expect(t.state.snapshot.id).toBe('s2');
    expect(t.state.baseSnapshot?.id).toBe('s1');
    // Начальная загрузка без анимации перехода
    expect(t.animateTransition).not.toHaveBeenCalled();
    expect(t.onApply).toHaveBeenCalledTimes(1);
  });

  it('последний срез в истории: предыдущего нет; сбой загрузки предыдущего не мешает показать текущий', async () => {
    const list = [summary('s2', '2026-10-18'), summary('s1', '2026-10-17')];
    const t = setup({
      fetchSnapshotById: async id => {
        if (id === 's2') throw new Error('network');
        return snap(id);
      },
    });
    t.state.snapshotsList = list;
    t.state.baseSnapshot = snap('stale');

    await t.controller.selectSnapshot('s1', true);
    expect(t.state.snapshot.id).toBe('s1');
    expect(t.state.baseSnapshot).toBeNull();
    expect(t.animateTransition).toHaveBeenCalledTimes(1);

    const t2 = setup({
      fetchSnapshotById: async id => {
        if (id === 's1') throw new Error('network');
        return snap(id);
      },
    });
    t2.state.snapshotsList = list;
    await t2.controller.selectSnapshot('s2', false);
    expect(t2.state.snapshot.id).toBe('s2');
    expect(t2.state.baseSnapshot).toBeNull();
    expect(t2.onApply).toHaveBeenCalledTimes(1);
  });

  it('снимок не загрузился — экран не перерисовывается и состояние не меняется', async () => {
    const t = setup({ fetchSnapshotById: async () => undefined });
    await t.controller.selectSnapshot('missing');
    expect(t.state.snapshot).toBe(FALLBACK_SNAPSHOT);
    expect(t.state.currentSnapshotId).toBe('');
    expect(t.onApply).not.toHaveBeenCalled();
  });
});
